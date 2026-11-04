import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { BusinessError } from '../common/filters/business-error';
import { DRIZZLE } from '../db/db.constants';
import { webauthnCredential } from '../db/schema';
import { AuditService } from '../security/audit.service';
import { storeChallenge, takeChallenge } from '../session/challenge';
import { grantStepUp } from '../session/consume-step-up';
import { requireMemberId } from '../session/require-member-id';
import { SingleUseStore } from '../session/single-use-store';
import { VerifyAuthenticationDto } from './dto/verify-authentication.dto';
import { rpConfig } from './rp-config';
import { WebauthnAssertionService } from './webauthn-assertion.service';
import { WebauthnCryptoService } from './webauthn-crypto.service';
import { clientIp } from '../common/client-ip.decorator';

// One generic error for a missing challenge, a foreign credential and a bad
// signature alike. 422, like consumeStepUp(): the member is still signed in,
// and the web client signs them out on any 401.
const STEP_UP_FAILED = 'Step-up verification failed.';

function stepUpFailed(): BusinessError {
  return new BusinessError(HttpStatus.UNPROCESSABLE_ENTITY, 'step_up_failed', STEP_UP_FAILED);
}

/**
 * Proves the signed-in caller still holds one of their passkeys, for the
 * mutations a hijacked session could turn into a takeover. Doesn't rotate
 * the session: it only grants the single-use proof that consumeStepUp()
 * spends.
 */
@Injectable()
export class WebauthnStepUpService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly config: ConfigService,
    private readonly crypto: WebauthnCryptoService,
    private readonly assertion: WebauthnAssertionService,
    private readonly audit: AuditService,
    private readonly singleUse: SingleUseStore,
  ) {}

  async generateOptions(req: Request): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const memberId = requireMemberId(req);
    const credentials = await this.db
      .select()
      .from(webauthnCredential)
      .where(eq(webauthnCredential.memberId, memberId));

    const options = await this.crypto.generateAuthenticationOptions({
      rpID: rpConfig(this.config).rpID,
      allowCredentials: credentials.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports ?? undefined,
      })),
      // What verifyAuthenticationResponse enforces by default.
      userVerification: 'required',
    });

    await storeChallenge(this.singleUse, req, 'stepUpChallenge', {
      challenge: options.challenge,
      memberId,
    });
    return options;
  }

  async verify(req: Request, dto: VerifyAuthenticationDto): Promise<{ message: string }> {
    const memberId = requireMemberId(req);
    const sourceAddress = clientIp(req);
    const pending = await takeChallenge(this.singleUse, req, 'stepUpChallenge');
    if (!pending || pending.memberId !== memberId) {
      throw stepUpFailed();
    }

    const credentialRow = await this.assertion.findCredential(dto.response.id);
    if (!credentialRow || credentialRow.memberId !== memberId) {
      throw stepUpFailed();
    }

    const verification = await this.assertion.verify(
      credentialRow,
      dto.response,
      pending.challenge,
    );
    if (!verification.verified) {
      throw stepUpFailed();
    }

    if (!(await this.assertion.recordUse(credentialRow, verification.newCounter))) {
      throw stepUpFailed();
    }

    await grantStepUp(this.singleUse, req, memberId);
    await this.audit.record('step_up_verified', memberId, sourceAddress);

    return { message: 'ok' };
  }
}

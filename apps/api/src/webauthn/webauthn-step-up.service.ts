import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PublicKeyCredentialRequestOptionsJSON,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { BusinessError } from '../common/filters/business-error';
import { DRIZZLE } from '../db/db.constants';
import { webauthnCredential } from '../db/schema';
import { AuditService } from '../security/audit.service';
import { storeChallenge, takeChallenge } from '../session/challenge';
import { requireMemberId } from '../session/require-member-id';
import '../session/step-up-session-data';
import { VerifyAuthenticationDto } from './dto/verify-authentication.dto';
import { rpConfig } from './rp-config';
import { WebauthnCryptoService } from './webauthn-crypto.service';

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
 * the session: it only sets the single-use `stepUpVerifiedAt` flag that
 * consumeStepUp() checks.
 */
@Injectable()
export class WebauthnStepUpService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly config: ConfigService,
    private readonly crypto: WebauthnCryptoService,
    private readonly audit: AuditService,
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

    storeChallenge(req.session, 'stepUpChallenge', options.challenge);
    req.session.stepUpMemberId = memberId;
    return options;
  }

  async verify(req: Request, dto: VerifyAuthenticationDto): Promise<{ message: string }> {
    const memberId = requireMemberId(req);
    const sourceAddress = req.ip ?? 'unknown';
    const expectedChallenge = takeChallenge(req.session, 'stepUpChallenge');
    const stashedMemberId = req.session.stepUpMemberId;
    delete req.session.stepUpMemberId;

    if (!expectedChallenge || stashedMemberId !== memberId) {
      throw stepUpFailed();
    }

    const [credentialRow] = await this.db
      .select()
      .from(webauthnCredential)
      .where(eq(webauthnCredential.credentialId, dto.response.id));
    if (!credentialRow || credentialRow.memberId !== memberId) {
      throw stepUpFailed();
    }

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await this.crypto.verifyAuthenticationResponse({
        response: dto.response,
        expectedChallenge,
        expectedOrigin: rpConfig(this.config).origin,
        expectedRPID: rpConfig(this.config).rpID,
        credential: {
          id: credentialRow.credentialId,
          publicKey: Buffer.from(credentialRow.publicKey, 'base64'),
          counter: credentialRow.counter,
          transports: credentialRow.transports ?? undefined,
        },
      });
    } catch {
      throw stepUpFailed();
    }

    if (!verification.verified) {
      throw stepUpFailed();
    }

    await this.db
      .update(webauthnCredential)
      .set({
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      })
      .where(eq(webauthnCredential.id, credentialRow.id));

    req.session.stepUpVerifiedAt = Date.now();
    await this.audit.record('step_up_verified', memberId, sourceAddress);

    return { message: 'ok' };
  }
}

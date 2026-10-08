import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PublicKeyCredentialRequestOptionsJSON,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { SchedulerCatchUpService } from '../auth/scheduler-catch-up.service';
import { BusinessError } from '../common/filters/business-error';
import { DRIZZLE } from '../db/db.constants';
import { member, webauthnCredential } from '../db/schema';
import { AuditService } from '../security/audit.service';
import { storeChallenge, takeChallenge } from '../session/challenge';
import { SessionRegistryService } from '../session/session-registry.service';
import { SessionRotationService } from '../session/session-rotation.service';
import '../session/webauthn-session-data';
import { VerifyAuthenticationDto } from './dto/verify-authentication.dto';
import { rpConfig } from './rp-config';
import { WebauthnCryptoService } from './webauthn-crypto.service';

// Unknown/removed credential and a bad signature are indistinguishable —
// one generic error path for both. A bare 401 here is safe: this only ever
// fires from the sign-in page, so the web client's global 401 handler
// redirecting to sign-in is a no-op there.
const INVALID_PASSKEY = 'Passkey sign-in failed.';

function invalidPasskey(): BusinessError {
  return new BusinessError(HttpStatus.UNAUTHORIZED, 'passkey_sign_in_failed', INVALID_PASSKEY);
}

/**
 * The sole, usernameless sign-in: options() names no credentials, so the
 * authenticator offers its discoverable passkeys for this site, and
 * verify() learns the member from the one that answered. Asking for an
 * email would reveal which addresses are registered and allow per-email
 * lockouts. Ends by rotating the session, then setting memberId.
 */
@Injectable()
export class WebauthnAuthenticationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly config: ConfigService,
    private readonly crypto: WebauthnCryptoService,
    private readonly sessionRotation: SessionRotationService,
    private readonly sessionRegistry: SessionRegistryService,
    private readonly schedulerCatchUp: SchedulerCatchUpService,
    private readonly audit: AuditService,
  ) {}

  async generateOptions(req: Request): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const options = await this.crypto.generateAuthenticationOptions({
      rpID: rpConfig(this.config).rpID,
      allowCredentials: [],
      userVerification: 'required',
    });
    storeChallenge(req.session, 'webauthnChallenge', options.challenge);
    return options;
  }

  async verify(req: Request, dto: VerifyAuthenticationDto): Promise<{ message: string }> {
    const sourceAddress = req.ip ?? 'unknown';
    const expectedChallenge = takeChallenge(req.session, 'webauthnChallenge');

    if (!expectedChallenge) {
      await this.audit.record('webauthn_sign_in_failure', null, sourceAddress);
      throw invalidPasskey();
    }

    const [credentialRow] = await this.db
      .select()
      .from(webauthnCredential)
      .where(eq(webauthnCredential.credentialId, dto.response.id));
    if (!credentialRow) {
      await this.audit.record('webauthn_sign_in_failure', null, sourceAddress);
      throw invalidPasskey();
    }
    const memberId = credentialRow.memberId;

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
      await this.audit.record('webauthn_sign_in_failure', memberId, sourceAddress);
      throw invalidPasskey();
    }

    if (!verification.verified) {
      await this.audit.record('webauthn_sign_in_failure', memberId, sourceAddress);
      throw invalidPasskey();
    }

    const [row] = await this.db.select().from(member).where(eq(member.id, memberId));
    if (!row) {
      await this.audit.record('webauthn_sign_in_failure', memberId, sourceAddress);
      throw invalidPasskey();
    }

    await this.db
      .update(webauthnCredential)
      .set({
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      })
      .where(eq(webauthnCredential.id, credentialRow.id));

    await this.sessionRotation.rotate(req);
    req.session.memberId = row.id;
    await this.sessionRegistry.register(row.id, req.sessionID);

    await this.db.update(member).set({ loggedAt: new Date() }).where(eq(member.id, row.id));

    await this.schedulerCatchUp.catchUp(row.id);
    await this.audit.record('webauthn_sign_in_success', row.id, sourceAddress);

    return { message: 'ok' };
  }
}

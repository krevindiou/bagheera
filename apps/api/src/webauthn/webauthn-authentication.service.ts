import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PublicKeyCredentialRequestOptionsJSON,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { SchedulerCatchUpService } from '../auth/scheduler-catch-up.service';
import { DRIZZLE } from '../db/db.constants';
import { member, webauthnCredential } from '../db/schema';
import { AuditService } from '../security/audit.service';
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

/**
 * The sole sign-in mechanism — there is no password path — and a
 * usernameless one: options() takes no email and names no credentials
 * (`allowCredentials: []`), so the member's authenticator offers whichever
 * of its discoverable passkeys belong to this site, and verify() learns who
 * is signing in from the credential that answered. Asking for an email
 * first used to tell anyone whether an address was registered (through
 * the credential ids options() returned for it) and let anyone lock a
 * member out through a per-email rate limit. Every passkey is registered as
 * discoverable for this reason (see build-registration-options.ts). Ends in
 * a session creation step (rotate then set memberId), same as every other
 * privilege-boundary crossing in this app.
 */
@Injectable()
export class WebauthnAuthenticationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly config: ConfigService,
    private readonly crypto: WebauthnCryptoService,
    private readonly sessionRotation: SessionRotationService,
    private readonly schedulerCatchUp: SchedulerCatchUpService,
    private readonly audit: AuditService,
  ) {}

  async generateOptions(req: Request): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const options = await this.crypto.generateAuthenticationOptions({
      rpID: rpConfig(this.config).rpID,
      allowCredentials: [],
      userVerification: 'required',
    });
    req.session.webauthnChallenge = options.challenge;
    return options;
  }

  async verify(req: Request, dto: VerifyAuthenticationDto): Promise<{ message: string }> {
    const sourceAddress = req.ip ?? 'unknown';
    const expectedChallenge = req.session.webauthnChallenge;
    delete req.session.webauthnChallenge;

    if (!expectedChallenge) {
      await this.audit.record('webauthn_sign_in_failure', null, sourceAddress);
      throw new UnauthorizedException(INVALID_PASSKEY);
    }

    const [credentialRow] = await this.db
      .select()
      .from(webauthnCredential)
      .where(eq(webauthnCredential.credentialId, dto.response.id));
    if (!credentialRow) {
      await this.audit.record('webauthn_sign_in_failure', null, sourceAddress);
      throw new UnauthorizedException(INVALID_PASSKEY);
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
      throw new UnauthorizedException(INVALID_PASSKEY);
    }

    if (!verification.verified) {
      await this.audit.record('webauthn_sign_in_failure', memberId, sourceAddress);
      throw new UnauthorizedException(INVALID_PASSKEY);
    }

    const [row] = await this.db.select().from(member).where(eq(member.id, memberId));
    if (!row) {
      await this.audit.record('webauthn_sign_in_failure', memberId, sourceAddress);
      throw new UnauthorizedException(INVALID_PASSKEY);
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

    await this.db.update(member).set({ loggedAt: new Date() }).where(eq(member.id, row.id));

    await this.schedulerCatchUp.catchUp(row.id);
    await this.audit.record('webauthn_sign_in_success', row.id, sourceAddress);

    return { message: 'ok' };
  }
}

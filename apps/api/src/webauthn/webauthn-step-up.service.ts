import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PublicKeyCredentialRequestOptionsJSON,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { webauthnCredential } from '../db/schema';
import { AuditService } from '../security/audit.service';
import { requireMemberId } from '../session/require-member-id';
import '../session/step-up-session-data';
import { VerifyAuthenticationDto } from './dto/verify-authentication.dto';
import { rpConfig } from './rp-config';
import { WebauthnCryptoService } from './webauthn-crypto.service';

// Never distinguishes a missing/expired challenge from an ownership
// mismatch from a bad signature — a single generic error path for all of
// them, same discipline as sign-in's own WebAuthn ceremony.
const STEP_UP_FAILED = 'Step-up verification failed.';

/**
 * Proves the caller still holds one of their own registered passkeys,
 * without creating a new session — the WebAuthn analog of "enter your
 * current password", gating the mutations a hijacked session could turn
 * into a permanent takeover (email change, adding or removing a passkey)
 * now that there is no password to ask for. Unlike
 * WebauthnAuthenticationService, this never calls SessionRotationService:
 * it only sets a short-lived, single-use `stepUpVerifiedAt` flag the
 * caller's next sensitive request consumes (see session/consume-step-up.ts
 * for the TTL and single-use rule).
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
      userVerification: 'preferred',
    });

    req.session.stepUpChallenge = options.challenge;
    req.session.stepUpMemberId = memberId;
    return options;
  }

  async verify(req: Request, dto: VerifyAuthenticationDto): Promise<{ message: string }> {
    const memberId = requireMemberId(req);
    const sourceAddress = req.ip ?? 'unknown';
    const expectedChallenge = req.session.stepUpChallenge;
    const stashedMemberId = req.session.stepUpMemberId;
    delete req.session.stepUpChallenge;
    delete req.session.stepUpMemberId;

    if (!expectedChallenge || stashedMemberId !== memberId) {
      throw new UnauthorizedException(STEP_UP_FAILED);
    }

    const [credentialRow] = await this.db
      .select()
      .from(webauthnCredential)
      .where(eq(webauthnCredential.credentialId, dto.response.id));
    if (!credentialRow || credentialRow.memberId !== memberId) {
      throw new UnauthorizedException(STEP_UP_FAILED);
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
      throw new UnauthorizedException(STEP_UP_FAILED);
    }

    if (!verification.verified) {
      throw new UnauthorizedException(STEP_UP_FAILED);
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

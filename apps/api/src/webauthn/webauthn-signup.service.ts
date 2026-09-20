import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  VerifiedRegistrationResponse,
} from '@simplewebauthn/server';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { member, webauthnCredential } from '../db/schema';
import { AuditService } from '../security/audit.service';
import { CryptoService } from '../security/crypto.service';
import { SessionRotationService } from '../session/session-rotation.service';
import '../session/signup-session-data';
import { parseSignupToken } from '../members/signup-token';
import { buildRegistrationOptions } from './build-registration-options';
import { credentialInsertValues } from './credential-insert-values';
import { SignupOptionsDto } from './dto/signup-options.dto';
import { VerifyRegistrationDto } from './dto/verify-registration.dto';
import { rpConfig } from './rp-config';
import { WebauthnCryptoService } from './webauthn-crypto.service';

// Never distinguishes an invalid/expired key from an already-registered
// email from an attestation failure — a single generic error path for all
// of them, same discipline as every other token-gated flow in this app.
const SIGNUP_FAILED = 'Sign-up link is invalid or has expired.';

// Postgres unique_violation — the email-uniqueness backstop for the
// member-row insert below (see race-safe-unique-email.ts, whose write side
// this mirrors without needing the shared helper itself: there's no
// existing row to exempt via `excludeId` here, and the anti-enumeration
// framing is already handled one step earlier, in RegistrationService).
const UNIQUE_VIOLATION = '23505';

/**
 * Completes sign-up: runs an unauthenticated WebAuthn registration ceremony
 * against a token minted by RegistrationService, and — only on success —
 * atomically inserts the member row *and* its first passkey together, then
 * signs them in. There is no earlier "row exists but not yet real" state to
 * transition out of (contrast the old activation flow): the account comes
 * into existence at the moment this ceremony succeeds, fully usable.
 */
@Injectable()
export class WebauthnSignupService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly webauthnCrypto: WebauthnCryptoService,
    private readonly sessionRotation: SessionRotationService,
    private readonly audit: AuditService,
  ) {}

  async generateOptions(
    req: Request,
    dto: SignupOptionsDto,
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const payload = parseSignupToken(this.crypto, dto.key);
    if (!payload) {
      throw new BadRequestException(SIGNUP_FAILED);
    }

    // Safe to reveal here (not an enumeration oracle): only whoever holds
    // this specific signed/encrypted token — i.e. controls the mailbox it
    // was sent to — can ever reach this branch at all.
    const [existing] = await this.db
      .select({ id: member.id })
      .from(member)
      .where(sql`lower(${member.email}) = lower(${payload.email})`);
    if (existing) {
      throw new BadRequestException(SIGNUP_FAILED);
    }

    const options = await buildRegistrationOptions(this.webauthnCrypto, this.config, {
      userName: payload.email,
      excludeCredentials: [],
    });

    req.session.pendingSignupChallenge = options.challenge;
    req.session.pendingSignupKey = dto.key;
    return options;
  }

  async verify(req: Request, dto: VerifyRegistrationDto): Promise<{ message: string }> {
    const sourceAddress = req.ip ?? 'unknown';
    const expectedChallenge = req.session.pendingSignupChallenge;
    const key = req.session.pendingSignupKey;
    delete req.session.pendingSignupChallenge;
    delete req.session.pendingSignupKey;

    if (!expectedChallenge || !key) {
      throw new BadRequestException(SIGNUP_FAILED);
    }

    // Re-parsed fresh, never trusting the options-time parse — the token
    // could have expired in the gap between the two calls.
    const payload = parseSignupToken(this.crypto, key);
    if (!payload) {
      throw new BadRequestException(SIGNUP_FAILED);
    }

    const { origin, rpID } = rpConfig(this.config);
    let verification: VerifiedRegistrationResponse;
    try {
      verification = await this.webauthnCrypto.verifyRegistrationResponse({
        response: dto.response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
    } catch {
      throw new BadRequestException(SIGNUP_FAILED);
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException(SIGNUP_FAILED);
    }

    let memberId: string;
    try {
      memberId = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(member)
          .values({
            email: payload.email,
            country: payload.country,
            locale: payload.locale,
            loggedAt: new Date(),
          })
          .returning({ id: member.id });
        await tx
          .insert(webauthnCredential)
          .values(credentialInsertValues(row.id, verification.registrationInfo, dto.deviceName));
        return row.id;
      });
    } catch (err) {
      if ((err as { cause?: { code?: string } }).cause?.code === UNIQUE_VIOLATION) {
        // Someone else completed sign-up for this email in the meantime
        // (e.g. a second outstanding link for the same address, see
        // signup-token.ts's TTL-only trade-off) — same generic error, not
        // an enumeration signal (only the mailbox owner reaches this at
        // all).
        throw new BadRequestException(SIGNUP_FAILED);
      }
      throw err;
    }

    await this.sessionRotation.rotate(req);
    req.session.memberId = memberId;
    await this.audit.record('passkey_signup_completed', memberId, sourceAddress);

    return { message: 'ok' };
  }
}

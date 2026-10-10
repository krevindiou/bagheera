import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  VerifiedRegistrationResponse,
} from '@simplewebauthn/server';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { BusinessError } from '../common/filters/business-error';
import { DRIZZLE } from '../db/db.constants';
import { member, webauthnCredential } from '../db/schema';
import { AuditService } from '../security/audit.service';
import { CryptoService } from '../security/crypto.service';
import { storeChallenge, takeChallenge } from '../session/challenge';
import { SessionRegistryService } from '../session/session-registry.service';
import { SessionRotationService } from '../session/session-rotation.service';
import '../session/signup-session-data';
import { parseSignupToken } from '../members/signup-token';
import { buildRegistrationOptions } from './build-registration-options';
import { credentialInsertValues } from './credential-insert-values';
import { SignupOptionsDto } from './dto/signup-options.dto';
import { VerifyRegistrationDto } from './dto/verify-registration.dto';
import { rpConfig } from './rp-config';
import { WebauthnCryptoService } from './webauthn-crypto.service';
import { clientIp } from '../common/client-ip.decorator';

// One generic error for an invalid/expired key, a registered email and an
// attestation failure alike.
const SIGNUP_FAILED = 'Sign-up link is invalid or has expired.';

function signupFailed(): BusinessError {
  return new BusinessError(HttpStatus.BAD_REQUEST, 'signup_link_invalid', SIGNUP_FAILED);
}

// Postgres unique_violation: the email-uniqueness backstop for the member
// insert below.
const UNIQUE_VIOLATION = '23505';

/**
 * Completes sign-up: a registration ceremony against the emailed sign-up
 * token that, only on success, inserts the member and its first passkey
 * together and signs them in. The account exists from that moment on.
 */
@Injectable()
export class WebauthnSignupService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly webauthnCrypto: WebauthnCryptoService,
    private readonly sessionRotation: SessionRotationService,
    private readonly sessionRegistry: SessionRegistryService,
    private readonly audit: AuditService,
  ) {}

  async generateOptions(
    req: Request,
    dto: SignupOptionsDto,
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const payload = parseSignupToken(this.crypto, dto.key);
    if (!payload) {
      throw signupFailed();
    }

    // Not an enumeration oracle: only the mailbox owner holds the token.
    const [existing] = await this.db
      .select({ id: member.id })
      .from(member)
      .where(sql`lower(${member.email}) = lower(${payload.email})`);
    if (existing) {
      throw signupFailed();
    }

    const options = await buildRegistrationOptions(this.webauthnCrypto, this.config, {
      userName: payload.email,
      excludeCredentials: [],
    });

    storeChallenge(req.session, 'pendingSignupChallenge', options.challenge);
    req.session.pendingSignupKey = dto.key;
    return options;
  }

  async verify(req: Request, dto: VerifyRegistrationDto): Promise<{ message: string }> {
    const sourceAddress = clientIp(req);
    const expectedChallenge = takeChallenge(req.session, 'pendingSignupChallenge');
    const key = req.session.pendingSignupKey;
    delete req.session.pendingSignupKey;

    if (!expectedChallenge || !key) {
      throw signupFailed();
    }

    // Re-parsed: the token may have expired since options().
    const payload = parseSignupToken(this.crypto, key);
    if (!payload) {
      throw signupFailed();
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
      throw signupFailed();
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw signupFailed();
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
            timeZone: payload.timeZone ?? null,
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
        // Another link for the same address completed sign-up first.
        throw signupFailed();
      }
      throw err;
    }

    await this.sessionRotation.rotate(req);
    req.session.memberId = memberId;
    await this.sessionRegistry.register(memberId, req.sessionID);
    await this.audit.record('passkey_signup_completed', memberId, sourceAddress);

    return { message: 'ok' };
  }
}

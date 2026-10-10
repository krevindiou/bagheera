import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VerifiedRegistrationResponse } from '@simplewebauthn/server';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { BusinessError } from '../common/filters/business-error';
import { DRIZZLE } from '../db/db.constants';
import { member, webauthnCredential } from '../db/schema';
import { EmailQueueService } from '../email/email-queue.service';
import { passkeyRegisteredEmail } from '../email/templates/passkey-registered.template';
import { AuditService } from '../security/audit.service';
import { storeChallenge, takeChallenge } from '../session/challenge';
import { consumeStepUp } from '../session/consume-step-up';
import { requireMemberId } from '../session/require-member-id';
import '../session/webauthn-session-data';
import { buildRegistrationOptions } from './build-registration-options';
import { credentialInsertValues } from './credential-insert-values';
import { VerifyRegistrationDto } from './dto/verify-registration.dto';
import { rpConfig } from './rp-config';
import { WebauthnCryptoService } from './webauthn-crypto.service';
import { clientIp } from '../common/client-ip.decorator';

const REGISTRATION_FAILED = 'Passkey registration failed.';

function registrationFailed(): BusinessError {
  return new BusinessError(
    HttpStatus.BAD_REQUEST,
    'passkey_registration_failed',
    REGISTRATION_FAILED,
  );
}

/**
 * Adds a passkey for a signed-in member. Starting the ceremony consumes a
 * step-up proof, or a hijacked session could plant its own credential; each
 * success emails the member an alert.
 */
@Injectable()
export class WebauthnRegistrationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly config: ConfigService,
    private readonly crypto: WebauthnCryptoService,
    private readonly emailQueue: EmailQueueService,
    private readonly audit: AuditService,
  ) {}

  async generateOptions(req: Request): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const memberId = requireMemberId(req);
    // Here, not in verify(), so the authenticator never mints a credential
    // the server then refuses. verify() is still gated: only this method
    // sets `registrationChallenge`.
    consumeStepUp(req);
    const [row] = await this.db.select().from(member).where(eq(member.id, memberId));
    if (!row) {
      throw registrationFailed();
    }

    const existing = await this.db
      .select()
      .from(webauthnCredential)
      .where(eq(webauthnCredential.memberId, memberId));

    const options = await buildRegistrationOptions(this.crypto, this.config, {
      userName: row.email,
      excludeCredentials: existing.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports ?? undefined,
      })),
    });

    storeChallenge(req.session, 'registrationChallenge', options.challenge);
    return options;
  }

  async verify(req: Request, dto: VerifyRegistrationDto): Promise<void> {
    const memberId = requireMemberId(req);
    const expectedChallenge = takeChallenge(req.session, 'registrationChallenge');
    if (!expectedChallenge) {
      throw registrationFailed();
    }

    const { origin, rpID } = rpConfig(this.config);
    let verification: VerifiedRegistrationResponse;
    try {
      verification = await this.crypto.verifyRegistrationResponse({
        response: dto.response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
    } catch {
      throw registrationFailed();
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw registrationFailed();
    }

    try {
      await this.db
        .insert(webauthnCredential)
        .values(credentialInsertValues(memberId, verification.registrationInfo, dto.deviceName));
    } catch {
      // Most likely the credentialId unique constraint (a retried request).
      throw registrationFailed();
    }

    const [row] = await this.db
      .select({ email: member.email, locale: member.locale })
      .from(member)
      .where(eq(member.id, memberId));
    if (row) {
      await this.emailQueue.enqueue(passkeyRegisteredEmail(row.email, row.locale));
    }
    await this.audit.record('webauthn_credential_registered', memberId, clientIp(req));
  }
}

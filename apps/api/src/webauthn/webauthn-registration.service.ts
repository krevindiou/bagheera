import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VerifiedRegistrationResponse } from '@simplewebauthn/server';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { BusinessError } from '../common/filters/business-error';
import { DRIZZLE } from '../db/db.constants';
import { isUniqueViolation } from '../db/pg-errors';
import { member, webauthnCredential } from '../db/schema';
import { EmailQueueService } from '../email/email-queue.service';
import { enqueueAlert } from '../email/enqueue-alert';
import { passkeyRegisteredEmail } from '../email/templates/passkey-registered.template';
import { AuditService } from '../security/audit.service';
import { storeChallenge, takeChallenge } from '../session/challenge';
import { consumeStepUp } from '../session/consume-step-up';
import { lockMemberAtSessionEpoch } from '../session/session-epoch';
import { requireMemberId } from '../session/require-member-id';
import { SingleUseStore } from '../session/single-use-store';
import { buildRegistrationOptions } from './build-registration-options';
import { credentialInsertValues } from './credential-insert-values';
import { VerifyRegistrationDto } from './dto/verify-registration.dto';
import { rpConfig } from './rp-config';
import { verificationFailureReason } from './verification-failure';
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
  private readonly logger = new Logger(WebauthnRegistrationService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly config: ConfigService,
    private readonly crypto: WebauthnCryptoService,
    private readonly emailQueue: EmailQueueService,
    private readonly audit: AuditService,
    private readonly singleUse: SingleUseStore,
  ) {}

  async generateOptions(req: Request): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const memberId = requireMemberId(req);
    // Here, not in verify(), so the authenticator never mints a credential
    // the server then refuses. verify() is still gated: only this method
    // stores a `registrationChallenge`.
    await consumeStepUp(this.singleUse, req);
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

    await storeChallenge(this.singleUse, req, 'registrationChallenge', {
      challenge: options.challenge,
    });
    return options;
  }

  async verify(req: Request, dto: VerifyRegistrationDto): Promise<void> {
    const memberId = requireMemberId(req);
    const pending = await takeChallenge(this.singleUse, req, 'registrationChallenge');
    if (!pending) {
      throw registrationFailed();
    }

    const { origin, rpID } = rpConfig(this.config);
    let verification: VerifiedRegistrationResponse;
    try {
      verification = await this.crypto.verifyRegistrationResponse({
        response: dto.response,
        expectedChallenge: pending.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
    } catch (err) {
      this.logger.warn(`Passkey attestation rejected: ${verificationFailureReason(err)}`);
      throw registrationFailed();
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw registrationFailed();
    }

    const { registrationInfo } = verification;
    let row: typeof member.$inferSelect;
    try {
      row = await this.db.transaction(async (tx) => {
        const locked = await lockMemberAtSessionEpoch(tx, memberId, req.session);
        await tx
          .insert(webauthnCredential)
          .values(credentialInsertValues(memberId, registrationInfo, dto.deviceName));
        return locked;
      });
    } catch (err) {
      // webauthn_credential_credential_id_unique: a retried request.
      if (isUniqueViolation(err)) {
        throw registrationFailed();
      }
      throw err;
    }

    await this.audit.record('webauthn_credential_registered', memberId, clientIp(req));
    await enqueueAlert(this.emailQueue, this.logger, passkeyRegisteredEmail(row.email, row.locale));
  }
}

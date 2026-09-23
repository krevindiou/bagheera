import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VerifiedRegistrationResponse } from '@simplewebauthn/server';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { member, webauthnCredential } from '../db/schema';
import { EmailQueueService } from '../email/email-queue.service';
import { passkeyRegisteredEmail } from '../email/templates/passkey-registered.template';
import { AuditService } from '../security/audit.service';
import { consumeStepUp } from '../session/consume-step-up';
import { requireMemberId } from '../session/require-member-id';
import '../session/webauthn-session-data';
import { buildRegistrationOptions } from './build-registration-options';
import { credentialInsertValues } from './credential-insert-values';
import { VerifyRegistrationDto } from './dto/verify-registration.dto';
import { rpConfig } from './rp-config';
import { WebauthnCryptoService } from './webauthn-crypto.service';

const REGISTRATION_FAILED = 'Passkey registration failed.';

/**
 * Registers an additional passkey for an already-authenticated member — a
 * second (or third, ...) credential alongside whatever they already have.
 * The session alone isn't enough: a hijacked-but-valid one could otherwise
 * plant a persistent credential of its own, so starting the ceremony
 * consumes a fresh step-up proof (see session/consume-step-up.ts), and
 * every successful registration still emails the member as an alert.
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
    // Here rather than in verify(): failing before the ceremony starts
    // means the member's authenticator never mints a credential the server
    // then refuses. verify() stays gated all the same — it only accepts
    // `registrationChallenge`, which nothing but this method ever sets.
    consumeStepUp(req);
    const [row] = await this.db.select().from(member).where(eq(member.id, memberId));
    if (!row) {
      throw new BadRequestException(REGISTRATION_FAILED);
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

    req.session.registrationChallenge = options.challenge;
    return options;
  }

  async verify(req: Request, dto: VerifyRegistrationDto): Promise<void> {
    const memberId = requireMemberId(req);
    const expectedChallenge = req.session.registrationChallenge;
    delete req.session.registrationChallenge;
    if (!expectedChallenge) {
      throw new BadRequestException(REGISTRATION_FAILED);
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
      throw new BadRequestException(REGISTRATION_FAILED);
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException(REGISTRATION_FAILED);
    }

    try {
      await this.db
        .insert(webauthnCredential)
        .values(credentialInsertValues(memberId, verification.registrationInfo, dto.deviceName));
    } catch {
      // Most likely the credentialId unique constraint — the same
      // authenticator credential registered twice (e.g. a retried request).
      throw new BadRequestException(REGISTRATION_FAILED);
    }

    const [row] = await this.db
      .select({ email: member.email, locale: member.locale })
      .from(member)
      .where(eq(member.id, memberId));
    if (row) {
      await this.emailQueue.enqueue(passkeyRegisteredEmail(row.email, row.locale));
    }
    await this.audit.record('webauthn_credential_registered', memberId, req.ip ?? 'unknown');
  }
}

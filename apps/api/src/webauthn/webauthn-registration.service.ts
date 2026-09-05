import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  VerifiedRegistrationResponse,
} from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { member, webauthnCredential } from '../db/schema';
import { EmailQueueService } from '../email/email-queue.service';
import { passkeyRegisteredEmail } from '../email/templates/passkey-registered.template';
import { AuditService } from '../security/audit.service';
import { requireMemberId } from '../session/require-member-id';
import '../session/webauthn-session-data';
import { VerifyRegistrationDto } from './dto/verify-registration.dto';
import { rpConfig } from './rp-config';

const REGISTRATION_FAILED = 'Passkey registration failed.';

/**
 * Registers a passkey as an additional, optional, passwordless sign-in
 * method for an already-authenticated member — not a second factor on top
 * of the password (member.password stays required and untouched). Requires
 * only a live session (the same bar as change-password's "current password"
 * check, no extra step-up): a hijacked-but-valid session could otherwise
 * plant a persistent credential, so every successful registration also
 * emails the member — the same alert a password change already sends.
 */
@Injectable()
export class WebauthnRegistrationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly config: ConfigService,
    private readonly emailQueue: EmailQueueService,
    private readonly audit: AuditService,
  ) {}

  async generateOptions(
    req: Request,
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const memberId = requireMemberId(req);
    const [row] = await this.db
      .select()
      .from(member)
      .where(eq(member.id, memberId));
    if (!row) {
      throw new BadRequestException(REGISTRATION_FAILED);
    }

    const existing = await this.db
      .select()
      .from(webauthnCredential)
      .where(eq(webauthnCredential.memberId, memberId));

    const { rpID, rpName } = rpConfig(this.config);
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: row.email,
      // Lets the authenticator prompt "you already have a passkey here"
      // instead of silently creating a duplicate for the same device.
      excludeCredentials: existing.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports ?? undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    req.session.webauthnChallenge = options.challenge;
    return options;
  }

  async verify(req: Request, dto: VerifyRegistrationDto): Promise<void> {
    const memberId = requireMemberId(req);
    const expectedChallenge = req.session.webauthnChallenge;
    delete req.session.webauthnChallenge;
    if (!expectedChallenge) {
      throw new BadRequestException(REGISTRATION_FAILED);
    }

    const { origin, rpID } = rpConfig(this.config);
    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
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

    const { credential } = verification.registrationInfo;
    try {
      await this.db.insert(webauthnCredential).values({
        memberId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64'),
        counter: credential.counter,
        transports: credential.transports ?? null,
        deviceName: dto.deviceName,
      });
    } catch {
      // Most likely the credentialId unique constraint — the same
      // authenticator credential registered twice (e.g. a retried request).
      throw new BadRequestException(REGISTRATION_FAILED);
    }

    const [row] = await this.db
      .select({ email: member.email })
      .from(member)
      .where(eq(member.id, memberId));
    if (row) {
      await this.emailQueue.enqueue(passkeyRegisteredEmail(row.email));
    }
    await this.audit.record(
      'webauthn_credential_registered',
      memberId,
      req.ip ?? 'unknown',
    );
  }
}

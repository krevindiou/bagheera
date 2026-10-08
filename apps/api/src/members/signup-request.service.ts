import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../db/db.constants';
import { EmailQueueService } from '../email/email-queue.service';
import type { SignupRequest } from '../email/email-message';
import { accountExistsEmail } from '../email/templates/account-exists.template';
import { AuditService } from '../security/audit.service';
import { CryptoService } from '../security/crypto.service';
import { findMemberByEmail } from './find-member-by-email';
import { sendSignupEmail } from './send-signup-email';

/**
 * The worker half of registration (see RegistrationService): turns a queued
 * request into one email. A new address gets a sign-up link; a registered
 * one an "account exists" notice in its member's language.
 */
@Injectable()
export class SignupRequestService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly crypto: CryptoService,
    private readonly emailQueue: EmailQueueService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async handle(request: SignupRequest): Promise<void> {
    const existing = await findMemberByEmail(this.db, request.email);
    if (existing) {
      const appUrl = this.config.getOrThrow<string>('APP_URL');
      await this.emailQueue.enqueue(
        accountExistsEmail(existing.email, `${appUrl}/${existing.locale}/sign-in`, existing.locale),
      );
      return;
    }

    await sendSignupEmail(
      { crypto: this.crypto, emailQueue: this.emailQueue, config: this.config },
      request.email,
      request.country,
      request.locale,
      request.timeZone,
    );
    await this.audit.record('signup_confirmation_issued', null, request.sourceAddress);
  }
}

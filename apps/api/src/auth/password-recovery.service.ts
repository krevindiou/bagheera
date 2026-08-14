import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../db/db.constants';
import { member } from '../db/schema';
import { EmailQueueService } from '../email/email-queue.service';
import { passwordChangedEmail } from '../email/templates/password-changed.template';
import { passwordRecoveryEmail } from '../email/templates/password-recovery.template';
import { AuditService } from '../security/audit.service';
import { CryptoService } from '../security/crypto.service';
import { HashService } from '../security/hash.service';
import { SessionTerminationService } from '../session/session-termination.service';
import { buildResetToken, parseResetToken } from './reset-token';

// A bad/expired/reused/unmatched-email key silently no-ops to the
// sign-in-equivalent response — never a field-level validation error.
const RESET_KEY_ERROR = 'Password reset error';

@Injectable()
export class PasswordRecoveryService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly crypto: CryptoService,
    private readonly hash: HashService,
    private readonly emailQueue: EmailQueueService,
    private readonly config: ConfigService,
    private readonly sessionTermination: SessionTerminationService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Always resolves the same way regardless of whether `email` matches a
   * member (no account enumeration); the email itself is sent
   * only when a match exists.
   */
  async requestReset(email: string, sourceAddress = 'unknown'): Promise<void> {
    const [row] = await this.db
      .select()
      .from(member)
      .where(sql`lower(${member.email}) = lower(${email})`);
    if (!row) {
      return;
    }

    const token = buildResetToken(
      this.crypto,
      row.email,
      row.passwordResetTokenVersion,
    );
    const appUrl = this.config.getOrThrow<string>('APP_URL');
    const changePasswordLink = `${appUrl}/en/reset-password?key=${encodeURIComponent(token)}`;
    await this.emailQueue.enqueue(
      passwordRecoveryEmail(row.email, changePasswordLink),
    );
    await this.audit.record(
      'password_recovery_requested',
      row.id,
      sourceAddress,
    );
  }

  async resetPassword(
    key: string,
    password: string,
    passwordConfirmation: string,
    sourceAddress = 'unknown',
  ): Promise<void> {
    if (password !== passwordConfirmation) {
      throw new BadRequestException("Passwords don't match.");
    }

    const payload = parseResetToken(this.crypto, key);
    if (!payload) {
      throw new BadRequestException(RESET_KEY_ERROR);
    }

    const [row] = await this.db
      .select()
      .from(member)
      .where(sql`lower(${member.email}) = lower(${payload.email})`);

    if (!row || row.passwordResetTokenVersion !== payload.version) {
      throw new BadRequestException(RESET_KEY_ERROR);
    }

    const passwordHash = await this.hash.hash(password);
    await this.db
      .update(member)
      .set({
        password: passwordHash,
        passwordResetTokenVersion: row.passwordResetTokenVersion + 1,
      })
      .where(eq(member.id, row.id));

    await this.sessionTermination.terminateAllSessions(row.id);
    await this.emailQueue.enqueue(passwordChangedEmail(row.email));
    await this.audit.record(
      'password_recovery_completed',
      row.id,
      sourceAddress,
    );
  }
}

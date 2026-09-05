import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { member } from '../db/schema';
import { EmailQueueService } from '../email/email-queue.service';
import { confirmEmailChangeEmail } from '../email/templates/confirm-email-change.template';
import { emailChangedEmail } from '../email/templates/email-changed.template';
import { AuditService } from '../security/audit.service';
import { CryptoService } from '../security/crypto.service';
import { HashService } from '../security/hash.service';
import '../session/session-data';
import {
  buildEmailChangeToken,
  parseEmailChangeToken,
} from './email-change-token';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { raceSafeUniqueEmail } from './race-safe-unique-email';

// Never distinguishes missing/malformed/expired/superseded/already-used
// keys from one another — a single generic error path for all of them,
// same as activation/password-reset.
const EMAIL_CHANGE_ERROR = 'Email change error (link expired or already used?)';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly hash: HashService,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
    private readonly emailQueue: EmailQueueService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Starts an email change: verifies the current password, then emails a
   * confirmation link to *dto.email* itself. `member.email` is not written
   * here — only `pendingEmail`/`emailChangeTokenVersion` are — so the
   * address on file never actually changes until whoever controls that
   * mailbox clicks through (see `confirmEmailChange`). A second request
   * before the first is confirmed simply supersedes it: the version bump
   * invalidates the earlier link.
   *
   * Resolves the same way (silently, no error) whether or not `dto.email`
   * is already registered to *another* member — surfacing "this email is
   * taken" would let any signed-in member enumerate registered accounts by
   * probing this endpoint with their own password. Mirrors
   * `RegistrationService.register`'s anti-enumeration behavior; the
   * race-safety here specifically is `raceSafeUniqueEmail`'s, shared with
   * `RegistrationService.register`.
   */
  async updateEmail(req: Request, dto: UpdateProfileDto): Promise<void> {
    const memberId = req.session.memberId;
    if (!memberId) {
      throw new UnauthorizedException();
    }

    const [row] = await this.db
      .select()
      .from(member)
      .where(eq(member.id, memberId));
    if (!row) {
      throw new UnauthorizedException();
    }

    const passwordOk = await this.hash.verify(
      row.password,
      dto.currentPassword,
    );
    if (!passwordOk) {
      throw new BadRequestException('Current password is invalid.');
    }

    // Nothing to change or confirm.
    if (dto.email.toLowerCase() === row.email.toLowerCase()) {
      return;
    }

    const nextVersion = row.emailChangeTokenVersion + 1;
    const result = await raceSafeUniqueEmail(
      this.db,
      dto.email,
      () =>
        this.db
          .update(member)
          .set({
            pendingEmail: dto.email,
            emailChangeTokenVersion: nextVersion,
          })
          .where(eq(member.id, row.id)),
      row.id,
    );
    if (!result.ok) {
      return;
    }

    const token = buildEmailChangeToken(
      this.crypto,
      row.id,
      dto.email,
      nextVersion,
    );
    const appUrl = this.config.getOrThrow<string>('APP_URL');
    const confirmLink = `${appUrl}/en/confirm-email-change?key=${encodeURIComponent(token)}`;
    await this.emailQueue.enqueue(
      confirmEmailChangeEmail(dto.email, confirmLink),
    );
    await this.audit.record(
      'email_change_requested',
      row.id,
      req.ip ?? 'unknown',
    );
  }

  /**
   * Completes an email change: writes `member.email` only once the new
   * address's owner has proven control of it via the emailed token. A bad,
   * expired, already-used, or superseded-by-a-later-request key all
   * collapse into the same generic error — never a field-level validation
   * error a caller could use to tell them apart. Looked up by the token's
   * `memberId` rather than an email, so this stays correct even if the
   * member's own current address changed (again) since the token was
   * issued — the version/pendingEmail check below is what actually decides
   * whether the token is still live, not which email currently identifies
   * the row.
   */
  async confirmEmailChange(
    key: string,
    sourceAddress = 'unknown',
  ): Promise<void> {
    const payload = parseEmailChangeToken(this.crypto, key);
    if (!payload) {
      throw new BadRequestException(EMAIL_CHANGE_ERROR);
    }

    const [row] = await this.db
      .select()
      .from(member)
      .where(eq(member.id, payload.memberId));

    if (
      !row ||
      row.pendingEmail !== payload.newEmail ||
      row.emailChangeTokenVersion !== payload.version
    ) {
      throw new BadRequestException(EMAIL_CHANGE_ERROR);
    }

    const previousEmail = row.email;
    // Re-checked here, not just at request time — someone else could have
    // claimed this exact address in the meantime (a fresh registration, or
    // their own confirmed change), and only the write below is atomic
    // against that.
    const result = await raceSafeUniqueEmail(
      this.db,
      payload.newEmail,
      () =>
        this.db
          .update(member)
          .set({
            email: payload.newEmail,
            pendingEmail: null,
            // Bumped again so this same link can't be replayed.
            emailChangeTokenVersion: row.emailChangeTokenVersion + 1,
          })
          .where(eq(member.id, row.id)),
      row.id,
    );
    if (!result.ok) {
      throw new BadRequestException(EMAIL_CHANGE_ERROR);
    }

    await this.emailQueue.enqueue(
      emailChangedEmail(previousEmail, payload.newEmail),
    );
    await this.audit.record('email_changed', row.id, sourceAddress);
  }
}

import { HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { BusinessError } from '../common/filters/business-error';
import { DRIZZLE } from '../db/db.constants';
import { member } from '../db/schema';
import { EmailQueueService } from '../email/email-queue.service';
import { addressInUseEmail } from '../email/templates/address-in-use.template';
import { confirmEmailChangeEmail } from '../email/templates/confirm-email-change.template';
import { emailChangedEmail } from '../email/templates/email-changed.template';
import { AuditService } from '../security/audit.service';
import { CryptoService } from '../security/crypto.service';
import '../session/session-data';
import { SessionRegistryService } from '../session/session-registry.service';
import { consumeStepUp } from '../session/consume-step-up';
import { requireMemberId } from '../session/require-member-id';
import type { MemberId } from '../security/ids';
import { buildEmailChangeToken, parseEmailChangeToken } from './email-change-token';
import { UpdateLocaleDto } from './dto/update-locale.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateTimeZoneDto } from './dto/update-time-zone.dto';
import { findMemberByEmail } from './find-member-by-email';
import { raceSafeUniqueEmail } from './race-safe-unique-email';
import { CLIENT_IP_FALLBACK, clientIp } from '../common/client-ip.decorator';

// Never distinguishes missing/malformed/expired/superseded/already-used
// keys from one another — a single generic error path for all of them,
// same as the sign-up confirmation link.
const EMAIL_CHANGE_ERROR = 'Email change error (link expired or already used?)';

function emailChangeError(): BusinessError {
  return new BusinessError(HttpStatus.BAD_REQUEST, 'email_change_link_invalid', EMAIL_CHANGE_ERROR);
}

@Injectable()
export class ProfileService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly crypto: CryptoService,
    private readonly config: ConfigService,
    private readonly emailQueue: EmailQueueService,
    private readonly audit: AuditService,
    private readonly sessionRegistry: SessionRegistryService,
  ) {}

  /**
   * Starts an email change after a step-up proof: records `pendingEmail`,
   * bumps the token version (invalidating any earlier link) and emails a
   * confirmation link to the new address. `member.email` only changes in
   * `confirmEmailChange`.
   *
   * Does the same write and sends one email whether or not another member
   * holds `dto.email`, or a signed-in member could enumerate accounts (e.g.
   * by checking whether an earlier link still works). That owner is told
   * of the attempt instead of getting a link.
   */
  async updateEmail(req: Request, dto: UpdateProfileDto): Promise<void> {
    const memberId = requireMemberId(req);

    const [row] = await this.db.select().from(member).where(eq(member.id, memberId));
    if (!row) {
      throw new UnauthorizedException();
    }

    consumeStepUp(req);

    // Nothing to change or confirm.
    if (dto.email.toLowerCase() === row.email.toLowerCase()) {
      return;
    }

    const nextVersion = row.emailChangeTokenVersion + 1;
    // Never this member: their own address returned early above.
    const owner = await findMemberByEmail(this.db, dto.email);
    await this.db
      .update(member)
      .set({
        pendingEmail: dto.email,
        emailChangeTokenVersion: nextVersion,
      })
      .where(eq(member.id, row.id));

    if (owner) {
      await this.emailQueue.enqueue(addressInUseEmail(owner.email, owner.locale));
    } else {
      const token = buildEmailChangeToken(this.crypto, row.id, dto.email, nextVersion);
      const appUrl = this.config.getOrThrow<string>('APP_URL');
      const confirmLink = `${appUrl}/${row.locale}/confirm-email-change?key=${encodeURIComponent(token)}`;
      await this.emailQueue.enqueue(confirmEmailChangeEmail(dto.email, confirmLink, row.locale));
    }
    await this.audit.record('email_change_requested', row.id, clientIp(req));
  }

  /**
   * Completes an email change from the emailed token. Every bad, expired,
   * used or superseded key gets the same generic error. On success, signs
   * out the member's other sessions, sparing `currentSessionId`.
   */
  async confirmEmailChange(
    key: string,
    sourceAddress = CLIENT_IP_FALLBACK,
    currentSessionId?: string,
  ): Promise<void> {
    const payload = parseEmailChangeToken(this.crypto, key);
    if (!payload) {
      throw emailChangeError();
    }

    const [row] = await this.db.select().from(member).where(eq(member.id, payload.memberId));

    if (
      !row ||
      row.pendingEmail !== payload.newEmail ||
      row.emailChangeTokenVersion !== payload.version
    ) {
      throw emailChangeError();
    }

    const previousEmail = row.email;
    // Re-checked: someone may have claimed the address since the request.
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
      throw emailChangeError();
    }

    // The mailbox just changed hands: sessions opened before this point
    // (other than the one confirming, if it is the member's own) may belong
    // to whoever prompted the change.
    await this.sessionRegistry.revokeOthers(row.id, currentSessionId);

    await this.emailQueue.enqueue(emailChangedEmail(previousEmail, payload.newEmail, row.locale));
    await this.audit.record('email_changed', row.id, sourceAddress);
  }

  /** A display preference: no step-up, unlike updateEmail. */
  async updateLocale(memberId: MemberId, dto: UpdateLocaleDto): Promise<void> {
    await this.db.update(member).set({ locale: dto.locale }).where(eq(member.id, memberId));
  }

  /** A preference like the locale: no step-up. */
  async updateTimeZone(memberId: MemberId, dto: UpdateTimeZoneDto): Promise<void> {
    await this.db.update(member).set({ timeZone: dto.timeZone }).where(eq(member.id, memberId));
  }
}

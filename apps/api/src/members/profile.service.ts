import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { member } from '../db/schema';
import { EmailQueueService } from '../email/email-queue.service';
import { emailChangedEmail } from '../email/templates/email-changed.template';
import { AuditService } from '../security/audit.service';
import { HashService } from '../security/hash.service';
import '../session/session-data';
import { UpdateProfileDto } from './dto/update-profile.dto';

// Postgres unique_violation — guards the email-uniqueness race between the
// pre-check below and the update (see member schema's case-insensitive
// unique index).
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly hash: HashService,
    private readonly emailQueue: EmailQueueService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Resolves the same way (silently, no error) whether or not `dto.email`
   * is already registered to *another* member — surfacing "this email is
   * taken" would let any signed-in member enumerate registered accounts by
   * probing this endpoint with their own password. Mirrors
   * `RegistrationService.register`'s anti-enumeration behavior.
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

    const [existing] = await this.db
      .select({ id: member.id })
      .from(member)
      .where(sql`lower(${member.email}) = lower(${dto.email})`);
    if (existing && existing.id !== row.id) {
      return;
    }

    const previousEmail = row.email;
    // No re-activation required — `active` is left untouched.
    try {
      await this.db
        .update(member)
        .set({ email: dto.email })
        .where(eq(member.id, row.id));
    } catch (err) {
      if (
        (err as { cause?: { code?: string } }).cause?.code === UNIQUE_VIOLATION
      ) {
        return;
      }
      throw err;
    }

    await this.emailQueue.enqueue(emailChangedEmail(previousEmail, dto.email));
    await this.audit.record('email_changed', row.id, req.ip ?? 'unknown');
  }
}

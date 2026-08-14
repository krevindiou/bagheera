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

@Injectable()
export class ProfileService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly hash: HashService,
    private readonly emailQueue: EmailQueueService,
    private readonly audit: AuditService,
  ) {}

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
      throw new BadRequestException('Email is already registered.');
    }

    const previousEmail = row.email;
    // No re-activation required — `active` is left untouched.
    await this.db
      .update(member)
      .set({ email: dto.email })
      .where(eq(member.id, row.id));

    await this.emailQueue.enqueue(emailChangedEmail(previousEmail, dto.email));
    await this.audit.record('email_changed', row.id, req.ip ?? 'unknown');
  }
}

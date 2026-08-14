import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { member } from '../db/schema';
import { EmailQueueService } from '../email/email-queue.service';
import { passwordChangedEmail } from '../email/templates/password-changed.template';
import { AuditService } from '../security/audit.service';
import { HashService } from '../security/hash.service';
import { SessionTerminationService } from '../session/session-termination.service';
import '../session/session-data';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class ChangePasswordService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly hash: HashService,
    private readonly emailQueue: EmailQueueService,
    private readonly sessionTermination: SessionTerminationService,
    private readonly audit: AuditService,
  ) {}

  async changePassword(req: Request, dto: ChangePasswordDto): Promise<void> {
    const memberId = req.session.memberId;
    if (!memberId) {
      throw new UnauthorizedException();
    }

    if (dto.newPassword !== dto.newPasswordConfirmation) {
      throw new BadRequestException("Passwords don't match.");
    }

    const [row] = await this.db
      .select()
      .from(member)
      .where(eq(member.id, memberId));
    if (!row) {
      throw new UnauthorizedException();
    }

    const currentOk = await this.hash.verify(row.password, dto.currentPassword);
    if (!currentOk) {
      throw new BadRequestException('Current password is incorrect.');
    }

    const newHash = await this.hash.hash(dto.newPassword);
    await this.db
      .update(member)
      .set({
        password: newHash,
        // A signed-in password change invalidates outstanding reset keys
        // too — the old password could otherwise still be recovered via a
        // key issued before this change.
        passwordResetTokenVersion: row.passwordResetTokenVersion + 1,
      })
      .where(eq(member.id, row.id));

    await this.sessionTermination.terminateOtherSessions(
      row.id,
      req.session.id,
    );
    await this.emailQueue.enqueue(passwordChangedEmail(row.email));
    await this.audit.record('password_changed', row.id, req.ip ?? 'unknown');
  }
}

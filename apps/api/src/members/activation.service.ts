import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../db/db.constants';
import { member } from '../db/schema';
import { AuditService } from '../security/audit.service';
import { CryptoService } from '../security/crypto.service';
import { EmailQueueService } from '../email/email-queue.service';
import { parseActivationToken } from './activation-token';
import { sendActivationEmail } from './send-activation-email';

// Never distinguishes missing/malformed/expired/already-active keys
// from one another — a single generic error path for all of them.
const ACTIVATION_ERROR = 'Activation error (Already activated?)';

@Injectable()
export class ActivationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly crypto: CryptoService,
    private readonly emailQueue: EmailQueueService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async activate(key: string, sourceAddress = 'unknown'): Promise<void> {
    const payload = parseActivationToken(this.crypto, key);
    if (!payload) {
      throw new BadRequestException(ACTIVATION_ERROR);
    }

    const [row] = await this.db
      .select()
      .from(member)
      .where(sql`lower(${member.email}) = lower(${payload.email})`);

    if (!row || row.active || row.activationTokenVersion !== payload.version) {
      throw new BadRequestException(ACTIVATION_ERROR);
    }

    await this.db
      .update(member)
      .set({ active: true })
      .where(eq(member.id, row.id));
    await this.audit.record('activation_used', row.id, sourceAddress);
  }

  /**
   * Issues a fresh activation key with its own 24h expiry and bumps
   * `activationTokenVersion`, invalidating every previously issued key for
   * this member. Callers (the sign-in resend action) are responsible for
   * verifying the member's identity/credentials first
   * — this method trusts its `email` argument and silently no-ops for an
   * unknown or already-active member, so it never itself becomes an
   * enumeration oracle.
   */
  async reissue(email: string, sourceAddress = 'unknown'): Promise<void> {
    const [row] = await this.db
      .select()
      .from(member)
      .where(sql`lower(${member.email}) = lower(${email})`);

    if (!row || row.active) {
      return;
    }

    const nextVersion = row.activationTokenVersion + 1;
    await this.db
      .update(member)
      .set({ activationTokenVersion: nextVersion })
      .where(eq(member.id, row.id));

    await sendActivationEmail(
      { crypto: this.crypto, emailQueue: this.emailQueue, config: this.config },
      row.email,
      nextVersion,
    );
    await this.audit.record('activation_issued', row.id, sourceAddress);
  }
}

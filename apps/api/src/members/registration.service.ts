import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../db/db.constants';
import { member } from '../db/schema';
import { AuditService } from '../security/audit.service';
import { CryptoService } from '../security/crypto.service';
import { HashService } from '../security/hash.service';
import { EmailQueueService } from '../email/email-queue.service';
import { RegisterDto } from './dto/register.dto';
import { sendActivationEmail } from './send-activation-email';

// Postgres unique_violation — guards the email-uniqueness race between the
// pre-check below and the insert (see member schema's case-insensitive
// unique index).
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class RegistrationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly hash: HashService,
    private readonly crypto: CryptoService,
    private readonly emailQueue: EmailQueueService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Resolves the same way (silently, no error) whether or not `dto.email`
   * is already registered — surfacing "this email is taken" would let
   * anyone enumerate registered accounts through the sign-up form. Mirrors
   * `PasswordRecoveryService.requestReset`'s anti-enumeration behavior.
   */
  async register(dto: RegisterDto, sourceAddress = 'unknown'): Promise<void> {
    if (dto.password !== dto.passwordConfirmation) {
      throw new BadRequestException("Passwords don't match.");
    }

    const [existing] = await this.db
      .select({ id: member.id })
      .from(member)
      .where(sql`lower(${member.email}) = lower(${dto.email})`);
    if (existing) {
      return;
    }

    const passwordHash = await this.hash.hash(dto.password);

    let inserted: { id: number; activationTokenVersion: number };
    try {
      [inserted] = await this.db
        .insert(member)
        .values({
          email: dto.email,
          country: dto.country.toUpperCase(),
          password: passwordHash,
          active: false,
        })
        .returning({
          id: member.id,
          activationTokenVersion: member.activationTokenVersion,
        });
    } catch (err) {
      if (
        (err as { cause?: { code?: string } }).cause?.code === UNIQUE_VIOLATION
      ) {
        return;
      }
      throw err;
    }

    await sendActivationEmail(
      { crypto: this.crypto, emailQueue: this.emailQueue, config: this.config },
      dto.email,
      inserted.activationTokenVersion,
    );
    await this.audit.record('activation_issued', inserted.id, sourceAddress);
  }
}

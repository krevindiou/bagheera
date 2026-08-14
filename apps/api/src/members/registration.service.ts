import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../db/db.constants';
import { member } from '../db/schema';
import { CryptoService } from '../security/crypto.service';
import { HashService } from '../security/hash.service';
import { EmailQueueService } from '../email/email-queue.service';
import { registrationEmail } from '../email/templates/registration.template';
import { buildActivationToken } from './activation-token';
import { RegisterDto } from './dto/register.dto';

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
  ) {}

  async register(dto: RegisterDto): Promise<void> {
    if (dto.password !== dto.passwordConfirmation) {
      throw new BadRequestException("Passwords don't match.");
    }

    const [existing] = await this.db
      .select({ id: member.id })
      .from(member)
      .where(sql`lower(${member.email}) = lower(${dto.email})`);
    if (existing) {
      throw new BadRequestException('Email is already registered.');
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
        throw new BadRequestException('Email is already registered.');
      }
      throw err;
    }

    await this.sendActivationEmail(dto.email, inserted.activationTokenVersion);
  }

  async sendActivationEmail(email: string, version: number): Promise<void> {
    const token = buildActivationToken(this.crypto, email, version);
    const appUrl = this.config.getOrThrow<string>('APP_URL');
    const activationLink = `${appUrl}/en/activation?key=${encodeURIComponent(token)}`;
    await this.emailQueue.enqueue(registrationEmail(email, activationLink));
  }
}

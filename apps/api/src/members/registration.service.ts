import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../db/db.constants';
import { member } from '../db/schema';
import { AuditService } from '../security/audit.service';
import { CryptoService } from '../security/crypto.service';
import { HashService } from '../security/hash.service';
import { EmailQueueService } from '../email/email-queue.service';
import { RegisterDto } from './dto/register.dto';
import { raceSafeUniqueEmail } from './race-safe-unique-email';
import { sendActivationEmail } from './send-activation-email';

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
   * `PasswordRecoveryService.requestReset`'s anti-enumeration behavior; the
   * race-safety here specifically is `raceSafeUniqueEmail`'s, shared with
   * `ProfileService.updateEmail`.
   */
  async register(dto: RegisterDto, sourceAddress = 'unknown'): Promise<void> {
    if (dto.password !== dto.passwordConfirmation) {
      throw new BadRequestException("Passwords don't match.");
    }

    const passwordHash = await this.hash.hash(dto.password);

    const result = await raceSafeUniqueEmail(this.db, dto.email, () =>
      this.db
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
        })
        .then(([row]) => row),
    );
    if (!result.ok) {
      return;
    }

    await sendActivationEmail(
      { crypto: this.crypto, emailQueue: this.emailQueue, config: this.config },
      dto.email,
      result.value.activationTokenVersion,
    );
    await this.audit.record(
      'activation_issued',
      result.value.id,
      sourceAddress,
    );
  }
}

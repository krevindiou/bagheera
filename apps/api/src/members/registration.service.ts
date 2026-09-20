import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DEFAULT_LOCALE } from '../common/locale';
import { DRIZZLE } from '../db/db.constants';
import { member } from '../db/schema';
import { AuditService } from '../security/audit.service';
import { CryptoService } from '../security/crypto.service';
import { EmailQueueService } from '../email/email-queue.service';
import { RegisterDto } from './dto/register.dto';
import { sendSignupEmail } from './send-signup-email';

@Injectable()
export class RegistrationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly crypto: CryptoService,
    private readonly emailQueue: EmailQueueService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Resolves the same way (silently, no error) whether or not `dto.email`
   * is already registered — surfacing "this email is taken" would let
   * anyone enumerate registered accounts through the sign-up form. No
   * member row is created here at all — there's nothing to insert yet, the
   * account only comes into existence once the emailed link's WebAuthn
   * ceremony completes (see WebauthnSignupService). This is a read-only
   * existence check, not `raceSafeUniqueEmail`'s race-safe write — the
   * actual insert (and its own unique-index race handling) happens later,
   * at ceremony-completion time.
   */
  async register(dto: RegisterDto, sourceAddress = 'unknown'): Promise<void> {
    const [existing] = await this.db
      .select({ id: member.id })
      .from(member)
      .where(sql`lower(${member.email}) = lower(${dto.email})`);
    if (existing) {
      return;
    }

    const locale = dto.locale ?? DEFAULT_LOCALE;
    const country = dto.country.toUpperCase();
    await sendSignupEmail(
      { crypto: this.crypto, emailQueue: this.emailQueue, config: this.config },
      dto.email,
      country,
      locale,
    );
    await this.audit.record('signup_confirmation_issued', null, sourceAddress);
  }
}

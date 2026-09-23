import { Injectable } from '@nestjs/common';
import { DEFAULT_LOCALE } from '../common/locale';
import { EmailQueueService } from '../email/email-queue.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class RegistrationService {
  constructor(private readonly emailQueue: EmailQueueService) {}

  /**
   * Queues the request and returns — the same way, doing the same work,
   * whether or not `dto.email` is already registered. Looking the address
   * up here made a registered one measurably faster (one query) than a new
   * one (token, email, audit row), so the identical response still gave it
   * away; SignupRequestService does the lookup on the worker instead, and
   * sends either the sign-up link or an "account exists" notice. No member
   * row is created at all: the account only comes into existence once the
   * emailed link's WebAuthn ceremony completes (see WebauthnSignupService).
   */
  async register(dto: RegisterDto, sourceAddress = 'unknown'): Promise<void> {
    await this.emailQueue.enqueueSignupRequest({
      email: dto.email,
      country: dto.country.toUpperCase(),
      locale: dto.locale ?? DEFAULT_LOCALE,
      sourceAddress,
    });
  }
}

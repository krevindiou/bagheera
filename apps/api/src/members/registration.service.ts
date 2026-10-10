import { Injectable } from '@nestjs/common';
import { isValidTimeZone } from '../common/local-date';
import { DEFAULT_LOCALE } from '../common/locale';
import { EmailQueueService } from '../email/email-queue.service';
import { RegisterDto } from './dto/register.dto';
import { CLIENT_IP_FALLBACK } from '../common/client-ip.decorator';

@Injectable()
export class RegistrationService {
  constructor(private readonly emailQueue: EmailQueueService) {}

  /**
   * Only queues the request, so it does the same work whether or not
   * `dto.email` is registered: a lookup here would leak that through
   * timing. SignupRequestService does it on the worker. No member row is
   * created until the emailed link's passkey ceremony completes.
   */
  async register(dto: RegisterDto, sourceAddress = CLIENT_IP_FALLBACK): Promise<void> {
    await this.emailQueue.enqueueSignupRequest({
      email: dto.email,
      country: dto.country.toUpperCase(),
      locale: dto.locale ?? DEFAULT_LOCALE,
      timeZone: isValidTimeZone(dto.timeZone) ? dto.timeZone : undefined,
      sourceAddress,
    });
  }
}

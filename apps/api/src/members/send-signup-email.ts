import { ConfigService } from '@nestjs/config';
import { DEFAULT_LOCALE, type Locale } from '../common/locale';
import { EmailQueueService } from '../email/email-queue.service';
import { registrationEmail } from '../email/templates/registration.template';
import { CryptoService } from '../security/crypto.service';
import { buildSignupToken } from './signup-token';

/** Builds a sign-up confirmation link for the given email and enqueues the registration email. */
export async function sendSignupEmail(
  deps: {
    crypto: CryptoService;
    emailQueue: EmailQueueService;
    config: ConfigService;
  },
  email: string,
  country: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<void> {
  const token = buildSignupToken(deps.crypto, email, country, locale);
  const appUrl = deps.config.getOrThrow<string>('APP_URL');
  const activationLink = `${appUrl}/${locale}/activate?key=${encodeURIComponent(token)}`;
  await deps.emailQueue.enqueue(registrationEmail(email, activationLink, locale));
}

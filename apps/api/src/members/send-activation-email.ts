import { ConfigService } from '@nestjs/config';
import { EmailQueueService } from '../email/email-queue.service';
import { registrationEmail } from '../email/templates/registration.template';
import { CryptoService } from '../security/crypto.service';
import { buildActivationToken } from './activation-token';

/** Builds an activation link for the given member/version and enqueues the registration email. */
export async function sendActivationEmail(
  deps: {
    crypto: CryptoService;
    emailQueue: EmailQueueService;
    config: ConfigService;
  },
  email: string,
  version: number,
): Promise<void> {
  const token = buildActivationToken(deps.crypto, email, version);
  const appUrl = deps.config.getOrThrow<string>('APP_URL');
  const activationLink = `${appUrl}/en/activate?key=${encodeURIComponent(token)}`;
  await deps.emailQueue.enqueue(registrationEmail(email, activationLink));
}

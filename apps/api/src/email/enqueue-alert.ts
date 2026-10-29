import type { Logger } from '@nestjs/common';
import { Sentry } from '../logging/sentry';
import type { EmailMessage } from './email-message';
import type { EmailQueueService } from './email-queue.service';

/**
 * Queues a notice about a change that already committed. A queue outage must
 * not turn that success into an error (a spent confirmation link can't be
 * retried), but the lost alert is still reported.
 */
export async function enqueueAlert(
  emailQueue: Pick<EmailQueueService, 'enqueue'>,
  logger: Logger,
  message: EmailMessage,
): Promise<void> {
  try {
    await emailQueue.enqueue(message);
  } catch (err) {
    // Message only: the error is the queue's, but `message.to` stays out of logs.
    logger.error(`Alert email not queued: ${err instanceof Error ? err.message : 'unknown'}`);
    Sentry.captureException(err, { extra: { subject: message.subject } });
  }
}

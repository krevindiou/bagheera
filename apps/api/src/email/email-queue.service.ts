import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EMAIL_QUEUE } from './email.constants';
import { EmailMessage } from './email-message';

/**
 * Producer-side API: call sites enqueue a job and return immediately;
 * `EmailWorker` (same queue name) performs the actual send. Kept as a thin
 * wrapper so call sites (and their tests) depend on this instead of BullMQ
 * directly.
 */
@Injectable()
export class EmailQueueService {
  constructor(
    @Inject(EMAIL_QUEUE) private readonly queue: Queue<EmailMessage>,
  ) {}

  async enqueue(message: EmailMessage): Promise<void> {
    await this.queue.add('send', message, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }
}

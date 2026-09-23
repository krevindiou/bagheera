import { Inject, Injectable } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';
import { EMAIL_QUEUE, SEND_EMAIL_JOB, SIGNUP_REQUEST_JOB } from './email.constants';
import { EmailMessage, SignupRequest } from './email-message';

const JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  // BullMQ keeps every finished job by default, message and one-time links
  // included, and Valkey refuses writes once full (maxmemory + noeviction,
  // config/deploy.yml). Sent emails go at once; failures stay a week for
  // diagnosis, capped in number.
  removeOnComplete: true,
  removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
};

/**
 * Producer-side API: call sites enqueue a job and return immediately;
 * `EmailWorker` (same queue name) performs the actual send. Kept as a thin
 * wrapper so call sites (and their tests) depend on this instead of BullMQ
 * directly.
 */
@Injectable()
export class EmailQueueService {
  constructor(@Inject(EMAIL_QUEUE) private readonly queue: Queue<EmailMessage | SignupRequest>) {}

  async enqueue(message: EmailMessage): Promise<void> {
    await this.queue.add(SEND_EMAIL_JOB, message, JOB_OPTIONS);
  }

  /**
   * Queues a registration for the worker to resolve into either a sign-up
   * link or an "account exists" notice, so the request itself does the same
   * thing whether or not the address is registered.
   */
  async enqueueSignupRequest(request: SignupRequest): Promise<void> {
    await this.queue.add(SIGNUP_REQUEST_JOB, request, JOB_OPTIONS);
  }
}

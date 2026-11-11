import type { Job } from 'bullmq';
import { Sentry } from '../logging/sentry';
import { withoutQueryValues } from './error-message';

// BullMQ keeps the thrown error's message and stack in Valkey as the job's
// failure; a failed query's bound values must not end up there.
export async function withSafeJobErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    throw withoutQueryValues(err);
  }
}

// BullMQ emits 'failed' after every attempt; only the last one means the
// job is lost for good.
export function isFinalAttempt(job: Job): boolean {
  return job.attemptsMade >= (job.opts.attempts ?? 1);
}

// Only a lost job is worth an alert.
export function reportFinalJobFailure(job: Job | undefined, err: Error): void {
  if (!job || !isFinalAttempt(job)) {
    return;
  }
  Sentry.captureException(withoutQueryValues(err), {
    extra: { queue: job.queueName, jobId: job.id, jobName: job.name },
  });
}

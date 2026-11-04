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
// job is lost for good, so only that one is worth an alert.
export function reportFinalJobFailure(job: Job | undefined, err: Error): void {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) {
    return;
  }
  Sentry.captureException(withoutQueryValues(err), {
    extra: { queue: job.queueName, jobId: job.id, jobName: job.name },
  });
}

import type { Job } from 'bullmq';
import { Sentry } from '../logging/sentry';

// BullMQ emits 'failed' after every attempt; only the last one means the
// job is lost for good, so only that one is worth an alert.
export function reportFinalJobFailure(job: Job | undefined, err: Error): void {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) {
    return;
  }
  Sentry.captureException(err, {
    extra: { queue: job.queueName, jobId: job.id, jobName: job.name },
  });
}

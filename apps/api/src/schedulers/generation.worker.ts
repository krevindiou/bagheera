import { Logger } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { reportFinalJobFailure } from '../common/report-job-failure';
import {
  GENERATION_QUEUE_NAME,
  GenerationJob,
  GenerationQueueService,
} from './generation-queue.service';
import { SchedulerGenerationService } from './generation.service';

const logger = new Logger('SchedulerGenerationWorker');

/**
 * Consumes GenerationQueueService's jobs one at a time, so generation holds
 * a single database connection. Each job stops at MAX_OCCURRENCES_PER_RUN;
 * the next save, sign-in or hourly sweep picks up the rest. Built and
 * closed by SchedulersModule.
 */
export function createGenerationWorker(
  connection: IORedis,
  generation: SchedulerGenerationService,
  generationQueue: GenerationQueueService,
): Worker<GenerationJob> {
  const worker = new Worker<GenerationJob>(
    GENERATION_QUEUE_NAME,
    async (job: Job<GenerationJob>) => {
      if ('schedulerId' in job.data) {
        await generation.runForScheduler(job.data.schedulerId);
        return;
      }
      if ('sweep' in job.data) {
        // One job per due member rather than catching them all up here:
        // each gets its own retries and budget, and one member's failure
        // can't hold back the rest.
        for (const memberId of await generation.dueMemberIds()) {
          await generationQueue.enqueueMember(memberId);
        }
        return;
      }
      await generation.catchUpMember(job.data.memberId);
    },
    { connection, concurrency: 1 },
  );
  worker.on('failed', (job, err) => {
    logger.error(`Generation job ${job?.id} failed: ${err.message}`);
    reportFinalJobFailure(job, err);
  });
  return worker;
}

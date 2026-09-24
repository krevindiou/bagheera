import { Logger } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { GENERATION_QUEUE_NAME, GenerationJob } from './generation-queue.service';
import { SchedulerGenerationService } from './generation.service';

const logger = new Logger('SchedulerGenerationWorker');

/**
 * Consumes GenerationQueueService's jobs one at a time: however many
 * members save schedulers or sign in at once, generation holds a single
 * database connection, and each job stops at MAX_OCCURRENCES_PER_RUN — the
 * next save or sign-in picks up anything left. Built and closed by
 * SchedulersModule.
 */
export function createGenerationWorker(
  connection: IORedis,
  generation: SchedulerGenerationService,
): Worker<GenerationJob> {
  const worker = new Worker<GenerationJob>(
    GENERATION_QUEUE_NAME,
    async (job: Job<GenerationJob>) => {
      if ('schedulerId' in job.data) {
        await generation.runForScheduler(job.data.schedulerId);
        return;
      }
      await generation.catchUpMember(job.data.memberId);
    },
    { connection, concurrency: 1 },
  );
  worker.on('failed', (job, err) => {
    logger.error(`Generation job ${job?.id} failed: ${err.message}`);
  });
  return worker;
}

import { INestApplication } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { Server } from 'http';
import { GENERATION_QUEUE } from '../schedulers/generation-queue.service';

/**
 * Scheduler generation runs on a queue (see GenerationQueueService), so a
 * save or sign-in returns before its operations exist: this waits until the
 * app's own worker has nothing left waiting, running or retrying.
 */
export async function waitForSchedulerGeneration(
  app: INestApplication<Server>,
  timeoutMs = 10_000,
): Promise<void> {
  const queue = app.get<Queue>(GENERATION_QUEUE);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'prioritized');
    if (Object.values(counts).every((n) => n === 0)) {
      return;
    }
    if (Date.now() > deadline) {
      throw new Error(`Scheduler generation still busy: ${JSON.stringify(counts)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

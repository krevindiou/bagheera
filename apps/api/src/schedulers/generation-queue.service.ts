import { Inject, Injectable } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';

export const GENERATION_QUEUE_NAME = 'scheduler-generation';
export const GENERATION_QUEUE = Symbol('GENERATION_QUEUE');
export const GENERATION_QUEUE_CONNECTION = Symbol('GENERATION_QUEUE_CONNECTION');
export const GENERATION_WORKER_CONNECTION = Symbol('GENERATION_WORKER_CONNECTION');
export const GENERATION_WORKER = Symbol('GENERATION_WORKER');

/** One scheduler to bring up to date, or every one a member owns. */
export type GenerationJob = { schedulerId: string } | { memberId: string };

const JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: true,
  removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
};

/**
 * Producer side of scheduler generation: a save or a sign-in queues the
 * work and returns, and the worker (generation.worker.ts) does it one job
 * at a time. A save can be due up to a thousand operations (two thousand with
 * a transfer), which used to be inserted while the request waited, holding
 * one of the few database connections every member's requests share.
 */
@Injectable()
export class GenerationQueueService {
  constructor(@Inject(GENERATION_QUEUE) private readonly queue: Queue<GenerationJob>) {}

  async enqueueScheduler(schedulerId: string): Promise<void> {
    await this.queue.add('scheduler', { schedulerId }, JOB_OPTIONS);
  }

  async enqueueMember(memberId: string): Promise<void> {
    await this.queue.add('member', { memberId }, JOB_OPTIONS);
  }
}

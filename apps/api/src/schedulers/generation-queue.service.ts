import { Inject, Injectable } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';

export const GENERATION_QUEUE_NAME = 'scheduler-generation';
export const GENERATION_QUEUE = Symbol('GENERATION_QUEUE');
export const GENERATION_QUEUE_CONNECTION = Symbol('GENERATION_QUEUE_CONNECTION');
export const GENERATION_WORKER_CONNECTION = Symbol('GENERATION_WORKER_CONNECTION');
export const GENERATION_WORKER = Symbol('GENERATION_WORKER');

/**
 * One scheduler to bring up to date, every one a member owns, or — the
 * hourly sweep — every member with an occurrence due.
 */
export type GenerationJob = { schedulerId: string } | { memberId: string } | { sweep: true };

// Stable id of the job scheduler that queues the sweep: upserting under it
// on every boot updates the one entry instead of adding another.
export const SWEEP_JOB_SCHEDULER_ID = 'scheduler-generation-sweep';
// Hourly, not daily: each member's "today" turns over at their own
// midnight, so a daily run at one fixed hour would leave most time zones
// waiting most of a day for an occurrence due on theirs.
export const SWEEP_PATTERN = '0 * * * *';

const JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: true,
  removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
};

/**
 * Producer side of scheduler generation: a save or a sign-in queues the
 * work and returns, and the worker (generation.worker.ts) does it one job
 * at a time. An hourly sweep (see scheduleSweep) also catches up members
 * who neither save nor sign in, e.g. one whose session crosses midnight. A save can be due up to a thousand operations (two thousand with
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

  // Registers (or updates in place) the BullMQ job scheduler that queues a
  // sweep job every hour. The scheduler lives in Valkey and keeps only its
  // next run pending, so calling this on every boot, from any number of
  // instances, never duplicates it.
  async scheduleSweep(): Promise<void> {
    await this.queue.upsertJobScheduler(
      SWEEP_JOB_SCHEDULER_ID,
      { pattern: SWEEP_PATTERN },
      { name: 'sweep', data: { sweep: true }, opts: JOB_OPTIONS },
    );
  }
}

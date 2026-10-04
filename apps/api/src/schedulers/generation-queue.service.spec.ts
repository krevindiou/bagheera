import type { Queue } from 'bullmq';
import {
  GenerationJob,
  GenerationQueueService,
  SWEEP_JOB_SCHEDULER_ID,
  SWEEP_PATTERN,
} from './generation-queue.service';
import { vi } from 'vitest';

const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: true,
  removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
};

describe('GenerationQueueService', () => {
  const add = vi.fn().mockResolvedValue(undefined);
  const upsertJobScheduler = vi.fn().mockResolvedValue(undefined);
  const service = new GenerationQueueService({
    add,
    upsertJobScheduler,
  } as unknown as Queue<GenerationJob>);

  beforeEach(() => {
    add.mockClear();
    upsertJobScheduler.mockClear();
  });

  it("queues one scheduler's generation", async () => {
    await service.enqueueScheduler('s1');
    expect(add).toHaveBeenCalledWith('scheduler', { schedulerId: 's1' }, JOB_OPTIONS);
  });

  it("queues a member's whole catch-up", async () => {
    await service.enqueueMember('m1');
    expect(add).toHaveBeenCalledWith('member', { memberId: 'm1' }, JOB_OPTIONS);
  });

  it('registers the hourly sweep under one stable job scheduler id', async () => {
    await service.scheduleSweep();
    expect(upsertJobScheduler).toHaveBeenCalledWith(
      SWEEP_JOB_SCHEDULER_ID,
      { pattern: SWEEP_PATTERN },
      { name: 'sweep', data: { sweep: true }, opts: JOB_OPTIONS },
    );
  });
});

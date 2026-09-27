import { Logger } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import type IORedis from 'ioredis';
import { reportFinalJobFailure } from '../common/report-job-failure';
import type { GenerationJob } from './generation-queue.service';
import type { SchedulerGenerationService } from './generation.service';
import { createGenerationWorker } from './generation.worker';
import { vi, type Mock } from 'vitest';

// The real Worker would connect to Valkey and start polling — capture what
// it's handed instead. (Prefixed `mock` so vi.mock's hoisted factory may
// reference it.)
const mockWorker = { on: vi.fn() };
vi.mock('../common/report-job-failure', () => ({ reportFinalJobFailure: vi.fn() }));
vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(function Worker() {
    return mockWorker;
  }),
  // Unused by this spec directly, but SWC's emitted decorator metadata for
  // GenerationQueueService's constructor (Queue<GenerationJob>) reads this
  // named export the moment generation-queue.service.ts loads (transitively,
  // via generation.worker.ts) — vi.mock rejects reads of exports the
  // factory doesn't provide.
  Queue: class Queue {},
}));

type Processor = (job: Job<GenerationJob>) => Promise<void>;

describe('createGenerationWorker', () => {
  const generation = {
    runForScheduler: vi.fn().mockResolvedValue(3),
    catchUpMember: vi.fn().mockResolvedValue(false),
  };
  const connection = {} as IORedis;
  let processor: Processor;
  let options: { concurrency: number };

  beforeEach(() => {
    vi.clearAllMocks();
    createGenerationWorker(connection, generation as unknown as SchedulerGenerationService);
    [, processor, options] = (Worker as unknown as Mock).mock.calls[0] as [
      string,
      Processor,
      { concurrency: number },
    ];
  });

  it('runs one job at a time, so generation holds a single database connection', () => {
    expect(options.concurrency).toBe(1);
  });

  it("brings a saved scheduler's occurrences up to date", async () => {
    await processor({ data: { schedulerId: 's1' } } as Job<GenerationJob>);
    expect(generation.runForScheduler).toHaveBeenCalledWith('s1');
    expect(generation.catchUpMember).not.toHaveBeenCalled();
  });

  it('catches a member up on all their schedulers', async () => {
    await processor({ data: { memberId: 'm1' } } as Job<GenerationJob>);
    expect(generation.catchUpMember).toHaveBeenCalledWith('m1');
    expect(generation.runForScheduler).not.toHaveBeenCalled();
  });

  it('logs a job that failed', () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const [event, listener] = mockWorker.on.mock.calls[0] as [
      string,
      (job: { id: string }, err: Error) => void,
    ];

    const failed = { id: '7' };
    listener(failed, new Error('deadlock'));

    expect(event).toBe('failed');
    expect(reportFinalJobFailure).toHaveBeenCalledWith(failed, expect.any(Error));
    expect(error).toHaveBeenCalledWith('Generation job 7 failed: deadlock');
    error.mockRestore();
  });
});

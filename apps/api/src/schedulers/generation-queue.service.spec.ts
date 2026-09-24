import type { Queue } from 'bullmq';
import { GenerationJob, GenerationQueueService } from './generation-queue.service';

const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: true,
  removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
};

describe('GenerationQueueService', () => {
  const add = jest.fn().mockResolvedValue(undefined);
  const service = new GenerationQueueService({ add } as unknown as Queue<GenerationJob>);

  beforeEach(() => add.mockClear());

  it("queues one scheduler's generation", async () => {
    await service.enqueueScheduler('s1');
    expect(add).toHaveBeenCalledWith('scheduler', { schedulerId: 's1' }, JOB_OPTIONS);
  });

  it("queues a member's whole catch-up", async () => {
    await service.enqueueMember('m1');
    expect(add).toHaveBeenCalledWith('member', { memberId: 'm1' }, JOB_OPTIONS);
  });
});

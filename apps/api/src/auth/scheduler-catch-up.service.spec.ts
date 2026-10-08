import { Logger } from '@nestjs/common';
import type { GenerationQueueService } from '../schedulers/generation-queue.service';
import type { SchedulerGenerationService } from '../schedulers/generation.service';
import { SchedulerCatchUpService, SIGN_IN_CATCH_UP_BUDGET } from './scheduler-catch-up.service';
import { vi } from 'vitest';

describe('SchedulerCatchUpService', () => {
  function setup(behind: boolean | Error) {
    const generation = {
      catchUpMember:
        behind instanceof Error
          ? vi.fn().mockRejectedValue(behind)
          : vi.fn().mockResolvedValue(behind),
    };
    const queue = { enqueueMember: vi.fn().mockResolvedValue(undefined) };
    const service = new SchedulerCatchUpService(
      generation as unknown as SchedulerGenerationService,
      queue as unknown as GenerationQueueService,
    );
    return { service, generation, queue };
  }

  it('catches up to its budget while sign-in waits, queuing nothing more when that was enough', async () => {
    const { service, generation, queue } = setup(false);
    await service.catchUp('m1');
    expect(generation.catchUpMember).toHaveBeenCalledWith('m1', SIGN_IN_CATCH_UP_BUDGET);
    expect(queue.enqueueMember).not.toHaveBeenCalled();
  });

  it('queues the rest when the budget ran out', async () => {
    const { service, queue } = setup(true);
    await service.catchUp('m1');
    expect(queue.enqueueMember).toHaveBeenCalledWith('m1');
  });

  it('never fails sign-in: a catch-up that errors is left to the queue', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, queue } = setup(new Error('canceling statement due to statement timeout'));

    await expect(service.catchUp('m1')).resolves.toBeUndefined();

    expect(queue.enqueueMember).toHaveBeenCalledWith('m1');
    expect(warn).toHaveBeenCalledWith(
      'Sign-in catch-up left to the queue: canceling statement due to statement timeout',
    );
    warn.mockRestore();
  });
});

import { Injectable } from '@nestjs/common';
import { SchedulerGenerationService } from '../schedulers/generation.service';

/**
 * Runs a member's schedulers forward to catch up on any recurring
 * operations due since their last visit, on each successful
 * interactive sign-in. Delegates to the real generation engine — kept as
 * its own injectable so sign-in's code never had to change across the
 * stub-to-real swap.
 */
@Injectable()
export class SchedulerCatchUpService {
  constructor(private readonly generation: SchedulerGenerationService) {}

  catchUp(memberId: number): Promise<void> {
    return this.generation.catchUpMember(memberId);
  }
}

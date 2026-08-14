import { Injectable } from '@nestjs/common';

/**
 * Runs a member's schedulers forward to catch up on any recurring
 * operations due since their last visit, on each successful
 * interactive sign-in. No-op stub until schedulers exist — a later step
 * swaps this implementation for the real generation engine without touching
 * sign-in's code, since it's only ever consumed through this interface.
 */
@Injectable()
export class SchedulerCatchUpService {
  catchUp(memberId: number): Promise<void> {
    // Intentionally empty — see class doc.
    void memberId;
    return Promise.resolve();
  }
}

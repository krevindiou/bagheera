import { Injectable, Logger } from '@nestjs/common';
import { GenerationQueueService } from '../schedulers/generation-queue.service';
import { SchedulerGenerationService } from '../schedulers/generation.service';

// Occurrences generated while sign-in waits: enough to catch up any
// ordinary absence (a few months of a handful of monthly schedulers)
// before the dashboard loads, small enough to keep sign-in quick however
// far behind a member's schedulers are.
export const SIGN_IN_CATCH_UP_BUDGET = 100;

/**
 * Runs a member's schedulers forward to catch up on any recurring
 * operations due since their last visit, on each successful interactive
 * sign-in: up to SIGN_IN_CATCH_UP_BUDGET right away, anything beyond that
 * in the background (see GenerationQueueService).
 */
@Injectable()
export class SchedulerCatchUpService {
  private readonly logger = new Logger('SchedulerCatchUpService');

  constructor(
    private readonly generation: SchedulerGenerationService,
    private readonly generationQueue: GenerationQueueService,
  ) {}

  async catchUp(memberId: string): Promise<void> {
    let behind = true;
    try {
      behind = await this.generation.catchUpMember(memberId, SIGN_IN_CATCH_UP_BUDGET);
    } catch (err) {
      // Never fail a sign-in over it — the member is already signed in by
      // now (e.g. this waited too long on a scheduler a queued job was busy
      // with). Whatever didn't get done here, the queued job does.
      this.logger.warn(`Sign-in catch-up left to the queue: ${(err as Error).message}`);
    }
    if (behind) {
      await this.generationQueue.enqueueMember(memberId);
    }
  }
}

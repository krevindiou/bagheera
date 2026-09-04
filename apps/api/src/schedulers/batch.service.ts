import { Inject, Injectable } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { operation, scheduler } from '../db/schema';
import { AuditService } from '../security/audit.service';
import { OwnershipService } from '../security/ownership.service';
import { requireMemberId } from '../session/require-member-id';

/**
 * Batch delete. Ownership is resolved per id via
 * OwnershipService.filterOwnedSchedulerIds, the same bank/account chain as
 * the single-scheduler endpoints: an id belonging to another member, or
 * reachable only through a deleted or closed bank/account, is dropped
 * rather than rejected — the caller never learns which of its ids were
 * foreign vs. simply didn't exist. Closed accounts are dropped too:
 * existing schedulers on closed accounts are listable only, so batch
 * delete must reject them the same way the single-scheduler `remove()` does.
 */
@Injectable()
export class SchedulerBatchService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly audit: AuditService,
    private readonly ownership: OwnershipService,
  ) {}

  async batchDelete(
    req: Request,
    ids: number[],
  ): Promise<{ deletedCount: number }> {
    const memberId = requireMemberId(req);
    const owned = await this.ownership.filterOwnedSchedulerIds(ids, memberId);
    if (owned.length > 0) {
      await this.db.transaction(async (tx) => {
        // Already-generated operations survive; only their link to the
        // deleted schedulers is dropped.
        await tx
          .update(operation)
          .set({ schedulerId: null })
          .where(inArray(operation.schedulerId, owned));
        await tx.delete(scheduler).where(inArray(scheduler.id, owned));
      });
    }
    await this.audit.record(
      'scheduler_batch_deleted',
      memberId,
      req.ip ?? 'unknown',
    );
    return { deletedCount: owned.length };
  }
}

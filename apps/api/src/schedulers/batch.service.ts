import { Inject, Injectable } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { MemberId } from '../security/ids';
import { DRIZZLE } from '../db/db.constants';
import { operation, scheduler } from '../db/schema';
import { AuditService } from '../security/audit.service';
import { OwnershipService } from '../security/ownership.service';

/**
 * Batch delete. Ids that are foreign, unknown, or on a closed or deleted
 * chain (see filterOwnedSchedulerIds) are silently dropped.
 */
@Injectable()
export class SchedulerBatchService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly audit: AuditService,
    private readonly ownership: OwnershipService,
  ) {}

  async batchDelete(
    memberId: MemberId,
    ip: string,
    ids: string[],
  ): Promise<{ deletedCount: number }> {
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
    await this.audit.record('scheduler_batch_deleted', memberId, ip);
    return { deletedCount: owned.length };
  }
}

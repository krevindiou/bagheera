import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { account, bank, operation, scheduler } from '../db/schema';
import { AuditService } from '../security/audit.service';
import '../session/session-data';

/**
 * Batch delete. Ownership is resolved per id via the same bank/account
 * chain as the single-scheduler endpoints: an id belonging to another
 * member, or reachable only through a deleted bank/account, is dropped
 * rather than rejected — the caller never learns which of its ids were
 * foreign vs. simply didn't exist.
 */
@Injectable()
export class SchedulerBatchService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly audit: AuditService,
  ) {}

  private requireMemberId(req: Request): number {
    const memberId = req.session.memberId;
    if (!memberId) {
      throw new UnauthorizedException();
    }
    return memberId;
  }

  private async ownedIds(ids: number[], memberId: number): Promise<number[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db
      .select({
        id: scheduler.id,
        memberId: bank.memberId,
        bankDeleted: bank.deleted,
        accountDeleted: account.deleted,
      })
      .from(scheduler)
      .innerJoin(account, eq(scheduler.accountId, account.id))
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(inArray(scheduler.id, ids));
    return rows
      .filter(
        (row) =>
          row.memberId === memberId && !row.bankDeleted && !row.accountDeleted,
      )
      .map((row) => row.id);
  }

  async batchDelete(
    req: Request,
    ids: number[],
  ): Promise<{ deletedCount: number }> {
    const memberId = this.requireMemberId(req);
    const owned = await this.ownedIds(ids, memberId);
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

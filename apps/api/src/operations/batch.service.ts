import { Inject, Injectable } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { operation } from '../db/schema';
import { AuditService } from '../security/audit.service';
import { OwnershipService } from '../security/ownership.service';
import { requireMemberId } from '../session/require-member-id';
import { TransferService } from './transfer.service';

/**
 * Batch delete/reconcile. Ownership is resolved per id via
 * OwnershipService.filterOwnedOperationIds, the same bank/account chain as
 * the single-operation endpoints: an id belonging to another member, or
 * reachable only through a deleted or closed bank/account, is dropped
 * rather than rejected — the caller never learns which of its ids were
 * foreign vs. simply didn't exist. Closed accounts are dropped too:
 * existing operations on closed accounts are listable only, so batch
 * delete/reconcile must reject them like any other edit attempt.
 */
@Injectable()
export class OperationBatchService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly audit: AuditService,
    private readonly transfers: TransferService,
    private readonly ownership: OwnershipService,
  ) {}

  async batchDelete(
    req: Request,
    ids: number[],
  ): Promise<{ deletedCount: number }> {
    const memberId = requireMemberId(req);
    const owned = await this.ownership.filterOwnedOperationIds(ids, memberId);
    if (owned.length > 0) {
      await this.db.transaction(async (tx) => {
        // A deleted operation's paired counterpart survives, converted to
        // an External transfer — must run before the rows themselves go.
        await this.transfers.convertSurvivorsOfDeleted(tx, owned);
        await tx.delete(operation).where(inArray(operation.id, owned));
      });
    }
    await this.audit.record(
      'operation_batch_deleted',
      memberId,
      req.ip ?? 'unknown',
    );
    return { deletedCount: owned.length };
  }

  async batchReconcile(
    req: Request,
    ids: number[],
  ): Promise<{ reconciledCount: number }> {
    const memberId = requireMemberId(req);
    const owned = await this.ownership.filterOwnedOperationIds(ids, memberId);
    if (owned.length > 0) {
      await this.db
        .update(operation)
        .set({ reconciled: true })
        .where(inArray(operation.id, owned));
    }
    await this.audit.record(
      'operation_batch_reconciled',
      memberId,
      req.ip ?? 'unknown',
    );
    return { reconciledCount: owned.length };
  }
}

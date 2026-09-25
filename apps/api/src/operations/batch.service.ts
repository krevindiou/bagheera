import { Inject, Injectable } from '@nestjs/common';
import { and, inArray, ne } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { MemberId } from '../security/ids';
import { DRIZZLE } from '../db/db.constants';
import { operation } from '../db/schema';
import { PAYMENT_METHOD_ID } from '../db/seed-data';
import { AuditService } from '../security/audit.service';
import { OwnershipService } from '../security/ownership.service';
import { TransferService } from './transfer.service';

// The "Initial balance" payment method, reserved for the system-generated
// opening operation — excluded from batch actions the same way
// OperationService.update() already blocks it from a single-item edit.
const OPENING_BALANCE_PAYMENT_METHOD_ID = PAYMENT_METHOD_ID.INITIAL_BALANCE;

/**
 * Batch delete/reconcile. Ownership is resolved per id via
 * OwnershipService.filterOwnedOperationIds, the same bank/account chain as
 * the single-operation endpoints: an id belonging to another member, or
 * reachable only through a deleted or closed bank/account, is dropped
 * rather than rejected — the caller never learns which of its ids were
 * foreign vs. simply didn't exist. Closed accounts are dropped too:
 * existing operations on closed accounts are listable only, so batch
 * delete/reconcile must reject them like any other edit attempt. The
 * system-generated opening-balance operation is dropped the same way —
 * it carries no individual Edit/Delete affordance of its own (see
 * OperationsPage.vue's isEditable()) and must stay just as unreachable
 * through a multi-select.
 */
@Injectable()
export class OperationBatchService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly audit: AuditService,
    private readonly transfers: TransferService,
    private readonly ownership: OwnershipService,
  ) {}

  private async excludeOpeningBalance(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return ids;
    const rows = await this.db
      .select({ id: operation.id })
      .from(operation)
      .where(
        and(
          inArray(operation.id, ids),
          ne(operation.paymentMethodId, OPENING_BALANCE_PAYMENT_METHOD_ID),
        ),
      );
    return rows.map((row) => row.id);
  }

  async batchDelete(
    memberId: MemberId,
    ip: string,
    ids: string[],
  ): Promise<{ deletedCount: number }> {
    const owned = await this.excludeOpeningBalance(
      await this.ownership.filterOwnedOperationIds(ids, memberId),
    );
    if (owned.length > 0) {
      await this.db.transaction(async (tx) => {
        // A deleted operation's paired counterpart survives, converted to
        // an External transfer — must run before the rows themselves go.
        await this.transfers.convertSurvivorsOfDeleted(tx, owned);
        await tx.delete(operation).where(inArray(operation.id, owned));
      });
    }
    await this.audit.record('operation_batch_deleted', memberId, ip);
    return { deletedCount: owned.length };
  }

  async batchReconcile(
    memberId: MemberId,
    ip: string,
    ids: string[],
  ): Promise<{ reconciledCount: number }> {
    const owned = await this.excludeOpeningBalance(
      await this.ownership.filterOwnedOperationIds(ids, memberId),
    );
    if (owned.length > 0) {
      await this.db.update(operation).set({ reconciled: true }).where(inArray(operation.id, owned));
    }
    await this.audit.record('operation_batch_reconciled', memberId, ip);
    return { reconciledCount: owned.length };
  }
}

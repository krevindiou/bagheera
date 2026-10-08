import { Inject, Injectable } from '@nestjs/common';
import { and, inArray, ne } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { MemberId } from '../security/ids';
import { DRIZZLE } from '../db/db.constants';
import { operation } from '../db/schema';
import { AuditService } from '../security/audit.service';
import { OwnershipService } from '../security/ownership.service';
import { OPENING_BALANCE_PAYMENT_METHOD_ID } from './entry-rules';
import { TransferService } from './transfer.service';

/**
 * Batch delete/reconcile. Ids that are foreign, unknown, on a closed or
 * deleted chain (see filterOwnedOperationIds), or the opening-balance
 * operation (not editable individually either) are silently dropped.
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

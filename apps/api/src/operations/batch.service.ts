import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { account, bank, operation } from '../db/schema';
import { AuditService } from '../security/audit.service';
import '../session/session-data';

/**
 * Batch delete/reconcile. Ownership is resolved per id via the same
 * bank/account chain as the single-operation endpoints: an id belonging to
 * another member, or reachable only through a deleted bank/account, is
 * dropped rather than rejected — the caller never learns which of its ids
 * were foreign vs. simply didn't exist.
 */
@Injectable()
export class OperationBatchService {
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
        id: operation.id,
        memberId: bank.memberId,
        bankDeleted: bank.deleted,
        accountDeleted: account.deleted,
      })
      .from(operation)
      .innerJoin(account, eq(operation.accountId, account.id))
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(inArray(operation.id, ids));
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
      await this.db.delete(operation).where(inArray(operation.id, owned));
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
    const memberId = this.requireMemberId(req);
    const owned = await this.ownedIds(ids, memberId);
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

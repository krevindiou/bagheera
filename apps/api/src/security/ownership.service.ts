import { HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BusinessError } from '../common/filters/business-error';
import { DRIZZLE } from '../db/db.constants';
import { account, bank, operation, report, scheduler } from '../db/schema';
import { AccountId, BankId, MemberId, OperationId, ReportId, SchedulerId } from './ids';
import type { QuotaKind } from './member-quotas';
import { isFullyActive, reachableAccountsOf } from './reachable';

async function total(query: PromiseLike<{ total: number }[]>): Promise<number> {
  const [row] = await query;
  return row.total;
}

/**
 * The bank→account(→operation/scheduler) ownership chain, and the flat
 * report.memberId check, in one place. `requireOwned*` answers "does this
 * row belong to this member and is it still reachable": a deleted bank or
 * account makes everything under it 404, even for the owner
 * (`requireOwnedBank` aside, see there). "Closed" is never folded in:
 * closed rows stay reachable, and each caller decides whether a mutation
 * needs a fully-active chain.
 *
 * The `filterOwned*` siblings serve batch endpoints: they silently drop
 * every id not owned AND fully active (bank and account neither closed nor
 * deleted). `filterOwnedAccountIds` is the exception: closed is allowed
 * there, for report account selection.
 */
@Injectable()
export class OwnershipService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  // How many of `kind` the member holds, for MEMBER_QUOTAS: reachable rows,
  // closed ones included. Runs on the pool, not a caller's transaction.
  async countOwned(kind: QuotaKind, memberId: MemberId): Promise<number> {
    const reachable = reachableAccountsOf(this.db, memberId);
    switch (kind) {
      case 'banks':
        return total(
          this.db
            .select({ total: count() })
            .from(bank)
            .where(and(eq(bank.memberId, memberId), eq(bank.deleted, false))),
        );
      case 'accounts':
        return total(
          this.db
            .select({ total: count() })
            .from(account)
            .innerJoin(bank, eq(account.bankId, bank.id))
            .where(reachable),
        );
      case 'schedulers':
        return total(
          this.db
            .select({ total: count() })
            .from(scheduler)
            .innerJoin(account, eq(scheduler.accountId, account.id))
            .innerJoin(bank, eq(account.bankId, bank.id))
            .where(reachable),
        );
      case 'reports':
        return total(
          this.db.select({ total: count() }).from(report).where(eq(report.memberId, memberId)),
        );
    }
  }

  // Closed banks included.
  async listOwnedBanks(memberId: MemberId) {
    return this.db
      .select()
      .from(bank)
      .where(and(eq(bank.memberId, memberId), eq(bank.deleted, false)))
      .orderBy(asc(bank.name));
  }

  // Unlike the account/operation/scheduler checks, a deleted bank doesn't
  // 404 for its owner: callers check `closed`/`deleted` themselves.
  async requireOwnedBank(id: BankId, memberId: MemberId) {
    const [row] = await this.db.select().from(bank).where(eq(bank.id, id));
    if (!row || row.memberId !== (memberId as string)) {
      throw new NotFoundException();
    }
    return row;
  }

  async requireOwnedAccount(id: AccountId, memberId: MemberId) {
    const [row] = await this.db
      .select({ account, bank })
      .from(account)
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(eq(account.id, id));
    if (
      !row ||
      row.bank.memberId !== (memberId as string) ||
      row.bank.deleted ||
      row.account.deleted
    ) {
      throw new NotFoundException();
    }
    return row;
  }

  // requireOwnedAccount plus a 422 when the account or its bank is closed.
  // Runs on the pool; inside a transaction, use isFullyActive on a row
  // fetched through it (as TransferService.requireEligibleTarget does).
  async requireOwnedFullyActiveAccount(id: AccountId, memberId: MemberId) {
    const row = await this.requireOwnedAccount(id, memberId);
    if (!isFullyActive(row.account, row.bank)) {
      throw new BusinessError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'account_not_active',
        'Account is not active.',
      );
    }
    return row;
  }

  async requireOwnedOperation(id: OperationId, memberId: MemberId) {
    const [row] = await this.db
      .select({ operation, account, bank })
      .from(operation)
      .innerJoin(account, eq(operation.accountId, account.id))
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(eq(operation.id, id));
    if (
      !row ||
      row.bank.memberId !== (memberId as string) ||
      row.bank.deleted ||
      row.account.deleted
    ) {
      throw new NotFoundException();
    }
    return row;
  }

  async requireOwnedScheduler(id: SchedulerId, memberId: MemberId) {
    const [row] = await this.db
      .select({ scheduler, account, bank })
      .from(scheduler)
      .innerJoin(account, eq(scheduler.accountId, account.id))
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(eq(scheduler.id, id));
    if (
      !row ||
      row.bank.memberId !== (memberId as string) ||
      row.bank.deleted ||
      row.account.deleted
    ) {
      throw new NotFoundException();
    }
    return row;
  }

  async requireOwnedReport(id: ReportId, memberId: MemberId) {
    const [row] = await this.db.select().from(report).where(eq(report.id, id));
    if (!row || row.memberId !== (memberId as string)) {
      throw new NotFoundException();
    }
    return row;
  }

  // Silently drops ids belonging to another member, unknown ids, and ids
  // reachable only through a closed/deleted bank or account — the caller
  // never learns which of its ids were foreign vs. simply weren't usable.
  async filterOwnedOperationIds(ids: string[], memberId: MemberId): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db
      .select({
        id: operation.id,
        memberId: bank.memberId,
        bankDeleted: bank.deleted,
        accountDeleted: account.deleted,
        bankClosed: bank.closed,
        accountClosed: account.closed,
      })
      .from(operation)
      .innerJoin(account, eq(operation.accountId, account.id))
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(inArray(operation.id, ids));
    return rows
      .filter(
        (row) =>
          row.memberId === memberId &&
          !row.bankDeleted &&
          !row.accountDeleted &&
          !row.bankClosed &&
          !row.accountClosed,
      )
      .map((row) => row.id);
  }

  async filterOwnedSchedulerIds(ids: string[], memberId: MemberId): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db
      .select({
        id: scheduler.id,
        memberId: bank.memberId,
        bankDeleted: bank.deleted,
        accountDeleted: account.deleted,
        bankClosed: bank.closed,
        accountClosed: account.closed,
      })
      .from(scheduler)
      .innerJoin(account, eq(scheduler.accountId, account.id))
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(inArray(scheduler.id, ids));
    return rows
      .filter(
        (row) =>
          row.memberId === memberId &&
          !row.bankDeleted &&
          !row.accountDeleted &&
          !row.bankClosed &&
          !row.accountClosed,
      )
      .map((row) => row.id);
  }

  // Unlike the siblings above, closed accounts are kept; foreign, unknown
  // and deleted-chain ids are dropped.
  async filterOwnedAccountIds(ids: string[], memberId: MemberId): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db
      .select({ id: account.id })
      .from(account)
      .where(and(inArray(account.id, ids), reachableAccountsOf(this.db, memberId)));
    return rows.map((row) => row.id);
  }

  async filterOwnedReportIds(ids: string[], memberId: MemberId): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db
      .select({ id: report.id, memberId: report.memberId })
      .from(report)
      .where(inArray(report.id, ids));
    return rows.filter((row) => row.memberId === memberId).map((row) => row.id);
  }
}

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../db/db.constants';
import { account, bank, operation, report, scheduler } from '../db/schema';

/**
 * The bank→account(→operation/scheduler) ownership chain, and the flat
 * report.memberId check, in one place. Every `requireOwned*` method answers
 * only "does this row belong to this member, and is it still reachable" —
 * a deleted bank or account makes everything under it unreachable (404,
 * even for the owner). "Closed" is never folded in here: closed rows stay
 * reachable (listable-only), and it's each caller's job to decide whether
 * it needs a fully-active chain for a mutation (operation/scheduler
 * services' own `requireFullyActive`) or just an active bank (the
 * closed/deleted check callers run themselves right after
 * `requireOwnedBank`, same as `bank.service.ts` always has).
 *
 * The `filterOwned*` siblings serve batch endpoints: given a set of ids,
 * each returns only the ones that are owned AND fully active (bank/account
 * both neither closed nor deleted) — silently dropping the rest, never
 * throwing. That's a different policy from the `requireOwned*` methods
 * above, not just a different arity of the same one.
 */
@Injectable()
export class OwnershipService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  // Unlike every other method here, a bank's own `deleted`/`closed` is not
  // folded into the throw — a non-owner still 404s regardless, but the
  // owner sees the row and decides what a closed/deleted bank means for
  // their call (bank.service.ts rejects it; account creation does too).
  async requireOwnedBank(id: number, memberId: number) {
    const [row] = await this.db.select().from(bank).where(eq(bank.id, id));
    if (!row || row.memberId !== memberId) {
      throw new NotFoundException();
    }
    return row;
  }

  async requireOwnedAccount(id: number, memberId: number) {
    const [row] = await this.db
      .select({ account, bank })
      .from(account)
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(eq(account.id, id));
    if (
      !row ||
      row.bank.memberId !== memberId ||
      row.bank.deleted ||
      row.account.deleted
    ) {
      throw new NotFoundException();
    }
    return row;
  }

  async requireOwnedOperation(id: number, memberId: number) {
    const [row] = await this.db
      .select({ operation, account, bank })
      .from(operation)
      .innerJoin(account, eq(operation.accountId, account.id))
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(eq(operation.id, id));
    if (
      !row ||
      row.bank.memberId !== memberId ||
      row.bank.deleted ||
      row.account.deleted
    ) {
      throw new NotFoundException();
    }
    return row;
  }

  async requireOwnedScheduler(id: number, memberId: number) {
    const [row] = await this.db
      .select({ scheduler, account, bank })
      .from(scheduler)
      .innerJoin(account, eq(scheduler.accountId, account.id))
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(eq(scheduler.id, id));
    if (
      !row ||
      row.bank.memberId !== memberId ||
      row.bank.deleted ||
      row.account.deleted
    ) {
      throw new NotFoundException();
    }
    return row;
  }

  async requireOwnedReport(id: number, memberId: number) {
    const [row] = await this.db.select().from(report).where(eq(report.id, id));
    if (!row || row.memberId !== memberId) {
      throw new NotFoundException();
    }
    return row;
  }

  // Silently drops ids belonging to another member, unknown ids, and ids
  // reachable only through a closed/deleted bank or account — the caller
  // never learns which of its ids were foreign vs. simply weren't usable.
  async filterOwnedOperationIds(
    ids: number[],
    memberId: number,
  ): Promise<number[]> {
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

  async filterOwnedSchedulerIds(
    ids: number[],
    memberId: number,
  ): Promise<number[]> {
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

  async filterOwnedReportIds(
    ids: number[],
    memberId: number,
  ): Promise<number[]> {
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

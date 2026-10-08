import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { localIsoDate } from '../common/local-date';
import { effectiveTimeZone } from '../common/member-today';
import { DRIZZLE } from '../db/db.constants';
import type { Executor } from '../db/executor';
import { account, bank, member, scheduler } from '../db/schema';
import { TransferService } from '../operations/transfer.service';
import { isFullyActive } from '../security/reachable';
import { dueOccurrences, MAX_OCCURRENCES_PER_RUN } from './generation/interval';

// Occurrences after the generation cursor, up to the member's own "today"
// (or the limit date if earlier), at most `limit`.
function dueDates(
  row: typeof scheduler.$inferSelect,
  timeZone: string | null,
  now: Date,
  limit: number,
): string[] {
  const today = localIsoDate(now, effectiveTimeZone(timeZone));
  const horizon = row.limitDate !== null && row.limitDate < today ? row.limitDate : today;
  return dueOccurrences({
    valueDate: row.valueDate,
    frequencyUnit: row.frequencyUnit,
    frequencyValue: row.frequencyValue,
    after: row.lastGeneratedDate,
    horizon,
    limit,
  });
}

@Injectable()
export class SchedulerGenerationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly transfers: TransferService,
  ) {}

  // One scheduler, in its own transaction — what a save's queued job runs
  // (see GenerationQueueService). Resolves to how many occurrences it
  // generated.
  runForScheduler(schedulerId: string, budget = MAX_OCCURRENCES_PER_RUN): Promise<number> {
    return this.db.transaction((tx) => this.generateForScheduler(tx, schedulerId, budget));
  }

  // Generates up to `budget` due occurrences. Idempotent: progress is the
  // `lastGeneratedDate` cursor, not the (editable, deletable) operation
  // rows, so a re-run resumes where the last one stopped. Resolves to how
  // many it generated.
  private async generateForScheduler(
    db: Executor,
    schedulerId: string,
    budget: number,
  ): Promise<number> {
    // Two runs at once for the same scheduler (a sign-in's catch-up and a
    // queued job, say) would both resume after the same latest occurrence
    // and insert it twice: this waits for the other to commit first. Taken
    // before reading anything, so the scheduler row below is current too.
    await db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${schedulerId}, 0))`);
    const [chain] = await db
      .select({ scheduler, account, bank, timeZone: member.timeZone })
      .from(scheduler)
      .innerJoin(account, eq(scheduler.accountId, account.id))
      .innerJoin(bank, eq(account.bankId, bank.id))
      .innerJoin(member, eq(bank.memberId, member.id))
      .where(eq(scheduler.id, schedulerId));
    if (!chain || !chain.scheduler.active || !isFullyActive(chain.account, chain.bank)) {
      return 0;
    }
    const { scheduler: row, account: acc, bank: bnk } = chain;
    const memberId = bnk.memberId;

    if (row.transferAccountId !== null) {
      const [target] = await db
        .select({ account, bank })
        .from(account)
        .innerJoin(bank, eq(account.bankId, bank.id))
        .where(eq(account.id, row.transferAccountId));
      if (!target || !isFullyActive(target.account, target.bank)) {
        return 0;
      }
    }

    const dates = dueDates(row, chain.timeZone, new Date(), budget);

    for (const valueDate of dates) {
      await this.transfers.insertWithMirror(
        db,
        {
          accountId: row.accountId,
          schedulerId: row.id,
          thirdParty: row.thirdParty,
          debit: row.debit,
          credit: row.credit,
          categoryId: row.categoryId,
          paymentMethodId: row.paymentMethodId,
          transferAccountId: row.transferAccountId,
          valueDate,
          notes: row.notes,
          reconciled: row.reconciled,
        },
        {
          sourceCurrency: acc.currency,
          memberId,
        },
      );
    }

    if (dates.length > 0) {
      // Chronological, so the last date is the new cursor; same transaction
      // as the inserts.
      await db
        .update(scheduler)
        .set({ lastGeneratedDate: dates[dates.length - 1] })
        .where(eq(scheduler.id, row.id));
    }
    return dates.length;
  }

  // Members with an occurrence due now on an active scheduler of a fully
  // active account: what the hourly sweep queues. Reads every active
  // scheduler (the quota keeps that bounded). An inactive transfer target
  // isn't checked here; the catch-up then generates nothing for it.
  async dueMemberIds(now = new Date()): Promise<string[]> {
    const rows = await this.db
      .select({ scheduler, account, bank, timeZone: member.timeZone })
      .from(scheduler)
      .innerJoin(account, eq(scheduler.accountId, account.id))
      .innerJoin(bank, eq(account.bankId, bank.id))
      .innerJoin(member, eq(bank.memberId, member.id))
      .where(eq(scheduler.active, true));

    const due = new Set<string>();
    for (const row of rows) {
      if (due.has(row.bank.memberId) || !isFullyActive(row.account, row.bank)) {
        continue;
      }
      if (dueDates(row.scheduler, row.timeZone, now, 1).length > 0) {
        due.add(row.bank.memberId);
      }
    }
    return [...due];
  }

  // Runs catch-up for every active scheduler owned by a member, across all
  // their banks/accounts, sharing one `budget` of occurrences between them
  // — one transaction per scheduler so one failure can't roll back
  // another's already-generated occurrences. Resolves to whether the budget
  // ran out, i.e. whether some may still be behind.
  async catchUpMember(memberId: string, budget = MAX_OCCURRENCES_PER_RUN): Promise<boolean> {
    const rows = await this.db
      .select({ id: scheduler.id })
      .from(scheduler)
      .innerJoin(account, eq(scheduler.accountId, account.id))
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(and(eq(bank.memberId, memberId), eq(scheduler.active, true)));

    let remaining = budget;
    for (const { id } of rows) {
      if (remaining <= 0) {
        break;
      }
      remaining -= await this.db.transaction((tx) => this.generateForScheduler(tx, id, remaining));
    }
    return remaining <= 0;
  }
}

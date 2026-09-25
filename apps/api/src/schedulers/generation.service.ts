import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { localIsoDate } from '../common/local-date';
import { DRIZZLE } from '../db/db.constants';
import type { Executor } from '../db/executor';
import { account, bank, operation, scheduler } from '../db/schema';
import { TransferService } from '../operations/transfer.service';
import { dueOccurrences, MAX_OCCURRENCES_PER_RUN } from './generation/interval';

type AccountRow = typeof account.$inferSelect;
type BankRow = typeof bank.$inferSelect;

// The transaction surface TransferService also takes — generation always
// runs inside one, so its advisory lock holds until the run commits.

function isFullyActive(acc: AccountRow, bnk: BankRow): boolean {
  return !acc.closed && !acc.deleted && !bnk.closed && !bnk.deleted;
}

function todayIsoDate(): string {
  return localIsoDate();
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

  // Generates every occurrence a single scheduler is due for, up to today
  // (or its limit date if earlier) — at most `budget`, so an oversized
  // backlog is worked through a batch at a time rather than in one
  // unbounded run. Safe to call repeatedly — occurrence tracking is derived
  // from the latest surviving generated operation on the scheduler's own
  // account, so re-running is a no-op once caught up (or, mid-backlog,
  // resumes exactly where the previous run's cap cut it off). Resolves to
  // how many it generated.
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
      .select({ scheduler, account, bank })
      .from(scheduler)
      .innerJoin(account, eq(scheduler.accountId, account.id))
      .innerJoin(bank, eq(account.bankId, bank.id))
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

    const [latest] = await db
      .select({ valueDate: operation.valueDate })
      .from(operation)
      .where(and(eq(operation.schedulerId, row.id), eq(operation.accountId, row.accountId)))
      .orderBy(desc(operation.valueDate), desc(operation.id))
      .limit(1);

    const today = todayIsoDate();
    const horizon = row.limitDate !== null && row.limitDate < today ? row.limitDate : today;

    const dates = dueOccurrences({
      valueDate: row.valueDate,
      frequencyUnit: row.frequencyUnit,
      frequencyValue: row.frequencyValue,
      after: latest?.valueDate ?? null,
      horizon,
      limit: budget,
    });

    for (const valueDate of dates) {
      const [created] = await db
        .insert(operation)
        .values({
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
        })
        .returning();

      if (row.transferAccountId !== null) {
        // A freshly-generated occurrence can never have prior pairing
        // state, so this is always an attach — never sync()'s fuller
        // reconcile.
        const transferOperationId = await this.transfers.attach(
          db,
          {
            sourceOperationId: created.id,
            sourceAccountId: created.accountId,
            sourceCurrency: acc.currency,
            memberId,
          },
          row.transferAccountId,
          {
            paymentMethodId: created.paymentMethodId,
            debit: created.debit,
            credit: created.credit,
            thirdParty: created.thirdParty,
            valueDate: created.valueDate,
            notes: created.notes,
            schedulerId: created.schedulerId,
          },
        );
        await db.update(operation).set({ transferOperationId }).where(eq(operation.id, created.id));
      }
    }
    return dates.length;
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

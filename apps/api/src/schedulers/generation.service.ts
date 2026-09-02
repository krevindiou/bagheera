import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../db/db.constants';
import { account, bank, operation, scheduler } from '../db/schema';
import { TransferService } from '../operations/transfer.service';
import { dueOccurrences } from './generation/interval';

type SchedulerRow = typeof scheduler.$inferSelect;
type AccountRow = typeof account.$inferSelect;
type BankRow = typeof bank.$inferSelect;

// Same executor-or-transaction surface as TransferService, so generation
// can run inside a caller-owned transaction (post-save) or standalone
// (sign-in catch-up, one transaction per scheduler).
type Executor = Parameters<NodePgDatabase['transaction']>[0] extends (
  tx: infer T,
) => unknown
  ? T
  : never;
type Db = NodePgDatabase | Executor;

function isFullyActive(acc: AccountRow, bnk: BankRow): boolean {
  return !acc.closed && !acc.deleted && !bnk.closed && !bnk.deleted;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class SchedulerGenerationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly transfers: TransferService,
  ) {}

  // Generates every occurrence a single scheduler is due for, up to today
  // (or its limit date if earlier) — capped per call at
  // dueOccurrences' MAX_OCCURRENCES_PER_RUN, so an oversized backlog is
  // worked through a batch at a time rather than in one unbounded run.
  // Safe to call repeatedly — occurrence tracking is derived from the
  // latest surviving generated operation on the scheduler's own account,
  // so re-running is a no-op once caught up (or, mid-backlog, resumes
  // exactly where the previous run's cap cut it off).
  async generateForScheduler(
    db: Db,
    memberId: number,
    row: SchedulerRow,
    acc: AccountRow,
    bnk: BankRow,
  ): Promise<void> {
    if (!row.active || !isFullyActive(acc, bnk)) {
      return;
    }

    if (row.transferAccountId !== null) {
      const [target] = await db
        .select({ account, bank })
        .from(account)
        .innerJoin(bank, eq(account.bankId, bank.id))
        .where(eq(account.id, row.transferAccountId));
      if (!target || !isFullyActive(target.account, target.bank)) {
        return;
      }
    }

    const [latest] = await db
      .select({ valueDate: operation.valueDate })
      .from(operation)
      .where(
        and(
          eq(operation.schedulerId, row.id),
          eq(operation.accountId, row.accountId),
        ),
      )
      .orderBy(desc(operation.valueDate), desc(operation.id))
      .limit(1);

    const today = todayIsoDate();
    const horizon =
      row.limitDate !== null && row.limitDate < today ? row.limitDate : today;

    const dates = dueOccurrences({
      valueDate: row.valueDate,
      frequencyUnit: row.frequencyUnit,
      frequencyValue: row.frequencyValue,
      after: latest?.valueDate ?? null,
      horizon,
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
        const transferOperationId = await this.transfers.sync(db, {
          sourceId: created.id,
          sourceAccountId: created.accountId,
          sourceCurrency: acc.currency,
          memberId,
          previousTransferAccountId: null,
          previousTransferOperationId: null,
          desiredTransferAccountId: row.transferAccountId,
          paymentMethodId: created.paymentMethodId,
          debit: created.debit,
          credit: created.credit,
          thirdParty: created.thirdParty,
          valueDate: created.valueDate,
          notes: created.notes,
          schedulerId: created.schedulerId,
        });
        if (transferOperationId !== null) {
          await db
            .update(operation)
            .set({ transferOperationId })
            .where(eq(operation.id, created.id));
        }
      }
    }
  }

  // Runs catch-up for every active scheduler owned by a member, across all
  // their banks/accounts — one transaction per scheduler so one failure
  // can't roll back another's already-generated occurrences.
  async catchUpMember(memberId: number): Promise<void> {
    const rows = await this.db
      .select({ scheduler, account, bank })
      .from(scheduler)
      .innerJoin(account, eq(scheduler.accountId, account.id))
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(and(eq(bank.memberId, memberId), eq(scheduler.active, true)));

    for (const row of rows) {
      await this.db.transaction((tx) =>
        this.generateForScheduler(
          tx,
          memberId,
          row.scheduler,
          row.account,
          row.bank,
        ),
      );
    }
  }
}

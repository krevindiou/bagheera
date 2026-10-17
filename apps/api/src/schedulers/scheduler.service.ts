import { Inject, Injectable } from '@nestjs/common';
import { count, desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PAGE_SIZE } from '../common/pagination';
import { DRIZZLE } from '../db/db.constants';
import {
  accountCannotBeChanged,
  amountFields,
  requireFullyActive,
  requireFullyActiveLocked,
  transferAccountIdFor,
  validateTypedRefs,
} from '../operations/entry-rules';
import { operation, scheduler } from '../db/schema';
import { TransferService } from '../operations/transfer.service';
import { MemberId, AccountId, SchedulerId } from '../security/ids';
import { OwnershipService } from '../security/ownership.service';
import { CreateSchedulerDto } from './dto/create-scheduler.dto';
import { UpdateSchedulerDto } from './dto/update-scheduler.dto';
import { GenerationQueueService } from './generation-queue.service';
import { SchedulerGenerationService } from './generation.service';
import { nextOccurrence } from './generation/interval';
import type { SchedulerDto } from './dto/scheduler-response.dto';

// The internal generation cursor never reaches a client; only the next
// occurrence derived from it does.
function toSchedulerResponse(row: typeof scheduler.$inferSelect): SchedulerDto {
  const { lastGeneratedDate, ...rest } = row;
  return {
    ...rest,
    nextOccurrence: nextOccurrence({
      valueDate: row.valueDate,
      frequencyUnit: row.frequencyUnit,
      frequencyValue: row.frequencyValue,
      after: lastGeneratedDate,
      limitDate: row.limitDate,
      active: row.active,
    }),
  };
}

@Injectable()
export class SchedulerService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly generation: GenerationQueueService,
    private readonly generator: SchedulerGenerationService,
    private readonly transfers: TransferService,
    private readonly ownership: OwnershipService,
  ) {}

  async list(memberId: MemberId, accountId: string, page: number) {
    await this.ownership.requireOwnedAccount(accountId as AccountId, memberId);

    const rows = await this.db
      .select()
      .from(scheduler)
      .where(eq(scheduler.accountId, accountId))
      .orderBy(desc(scheduler.createdAt), desc(scheduler.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(scheduler)
      .where(eq(scheduler.accountId, accountId));

    return { items: rows.map(toSchedulerResponse), total, page, pageSize: PAGE_SIZE };
  }

  async create(memberId: MemberId, dto: CreateSchedulerDto) {
    const owned = await this.ownership.requireOwnedAccount(dto.accountId as AccountId, memberId);
    requireFullyActive(owned);
    await validateTypedRefs(this.db, dto.type, dto.paymentMethodId, dto.categoryId);

    const { debit, credit } = amountFields(dto.type, dto.amount);
    const transferAccountId = transferAccountIdFor(dto.paymentMethodId, dto.transferAccountId);
    await this.transfers.validateSchedulerTarget(
      this.db,
      {
        sourceAccountId: dto.accountId,
        sourceCurrency: owned.account.currency,
        memberId,
      },
      { targetAccountId: null },
      transferAccountId,
    );

    const created = await this.db.transaction(async (tx) => {
      await requireFullyActiveLocked(tx, dto.accountId as AccountId);

      await this.ownership.requireBelowQuotaLocked(tx, 'schedulers', memberId);

      const [created] = await tx
        .insert(scheduler)
        .values({
          accountId: dto.accountId,
          thirdParty: dto.thirdParty,
          debit,
          credit,
          categoryId: dto.categoryId,
          paymentMethodId: dto.paymentMethodId,
          transferAccountId,
          valueDate: dto.valueDate,
          notes: dto.notes ?? '',
          reconciled: dto.reconciled ?? false,
          limitDate: dto.limitDate,
          frequencyUnit: dto.frequencyUnit ?? 'month',
          frequencyValue: dto.frequencyValue,
          active: dto.active ?? true,
        })
        .returning();

      return created;
    });

    // May already be due (a value date today or in the past). Counted
    // before queueing, while the job can't have added any yet.
    const occurrencesDue = await this.generator.countDue(created.id);
    await this.generation.enqueueScheduler(created.id);

    return { scheduler: toSchedulerResponse(created), occurrencesDue };
  }

  // Resolves to how many occurrences the edit brings due, as for create.
  async update(memberId: MemberId, id: string, dto: UpdateSchedulerDto): Promise<number> {
    const owned = await this.ownership.requireOwnedScheduler(id as SchedulerId, memberId);
    requireFullyActive(owned);
    if (dto.accountId !== owned.scheduler.accountId) {
      throw accountCannotBeChanged();
    }
    await validateTypedRefs(this.db, dto.type, dto.paymentMethodId, dto.categoryId);

    const { debit, credit } = amountFields(dto.type, dto.amount);
    const transferAccountId = transferAccountIdFor(dto.paymentMethodId, dto.transferAccountId);
    await this.transfers.validateSchedulerTarget(
      this.db,
      {
        sourceAccountId: owned.scheduler.accountId,
        sourceCurrency: owned.account.currency,
        memberId,
      },
      { targetAccountId: owned.scheduler.transferAccountId },
      transferAccountId,
    );

    await this.db.transaction(async (tx) => {
      await requireFullyActiveLocked(tx, dto.accountId as AccountId);

      await tx
        .update(scheduler)
        .set({
          thirdParty: dto.thirdParty,
          debit,
          credit,
          categoryId: dto.categoryId ?? null,
          paymentMethodId: dto.paymentMethodId,
          transferAccountId,
          valueDate: dto.valueDate,
          notes: dto.notes ?? '',
          reconciled: dto.reconciled ?? false,
          limitDate: dto.limitDate ?? null,
          frequencyUnit: dto.frequencyUnit ?? 'month',
          frequencyValue: dto.frequencyValue,
          active: dto.active ?? true,
        })
        .where(eq(scheduler.id, id));
    });

    // An edit can bring new occurrences into range.
    const occurrencesDue = await this.generator.countDue(id);
    await this.generation.enqueueScheduler(id);
    return occurrencesDue;
  }

  async remove(memberId: MemberId, id: string): Promise<void> {
    const owned = await this.ownership.requireOwnedScheduler(id as SchedulerId, memberId);
    requireFullyActive(owned);

    await this.db.transaction(async (tx) => {
      await requireFullyActiveLocked(tx, owned.scheduler.accountId as AccountId);

      // Already-generated operations survive deletion; only their link to
      // this scheduler is dropped.
      await tx.update(operation).set({ schedulerId: null }).where(eq(operation.schedulerId, id));
      await tx.delete(scheduler).where(eq(scheduler.id, id));
    });
  }
}

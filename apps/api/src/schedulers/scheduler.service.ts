import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { count, desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { PAGE_SIZE } from '../common/pagination';
import { DRIZZLE } from '../db/db.constants';
import {
  amountFields,
  requireFullyActive,
  transferAccountIdFor,
  validateTypedRefs,
} from '../operations/entry-rules';
import { operation, scheduler } from '../db/schema';
import { TransferService } from '../operations/transfer.service';
import { AccountId, SchedulerId } from '../security/ids';
import { requireBelowQuota } from '../security/member-quotas';
import { OwnershipService } from '../security/ownership.service';
import { requireMemberId } from '../session/require-member-id';
import { CreateSchedulerDto } from './dto/create-scheduler.dto';
import { UpdateSchedulerDto } from './dto/update-scheduler.dto';
import { GenerationQueueService } from './generation-queue.service';

@Injectable()
export class SchedulerService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly generation: GenerationQueueService,
    private readonly transfers: TransferService,
    private readonly ownership: OwnershipService,
  ) {}

  async list(req: Request, accountId: string, page: number) {
    const memberId = requireMemberId(req);
    await this.ownership.requireOwnedAccount(accountId as AccountId, memberId);

    const pageNumber = page > 0 ? page : 1;
    const rows = await this.db
      .select()
      .from(scheduler)
      .where(eq(scheduler.accountId, accountId))
      .orderBy(desc(scheduler.createdAt), desc(scheduler.id))
      .limit(PAGE_SIZE)
      .offset((pageNumber - 1) * PAGE_SIZE);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(scheduler)
      .where(eq(scheduler.accountId, accountId));

    return { items: rows, total, page: pageNumber, pageSize: PAGE_SIZE };
  }

  async create(req: Request, dto: CreateSchedulerDto) {
    const memberId = requireMemberId(req);
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
    requireBelowQuota('schedulers', await this.ownership.countOwned('schedulers', memberId));

    const [created] = await this.db
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

    // A newly-created scheduler may already be due — e.g. a value date of
    // today, or in the past. Generation is queued after every save.
    await this.generation.enqueueScheduler(created.id);

    return created;
  }

  async update(req: Request, id: string, dto: UpdateSchedulerDto): Promise<void> {
    const memberId = requireMemberId(req);
    const owned = await this.ownership.requireOwnedScheduler(id as SchedulerId, memberId);
    requireFullyActive(owned);
    if (dto.accountId !== owned.scheduler.accountId) {
      throw new BadRequestException('Account cannot be changed.');
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

    await this.db
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

    // Editing a scheduler (e.g. changing its value date, interval, or
    // flipping it active) can bring new occurrences into range; generation
    // is queued after every save.
    await this.generation.enqueueScheduler(id);
  }

  async remove(req: Request, id: string): Promise<void> {
    const memberId = requireMemberId(req);
    const owned = await this.ownership.requireOwnedScheduler(id as SchedulerId, memberId);
    requireFullyActive(owned);

    await this.db.transaction(async (tx) => {
      // Already-generated operations survive deletion; only their link to
      // this scheduler is dropped.
      await tx.update(operation).set({ schedulerId: null }).where(eq(operation.schedulerId, id));
      await tx.delete(scheduler).where(eq(scheduler.id, id));
    });
  }
}

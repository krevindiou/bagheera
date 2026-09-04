import {
  BadRequestException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { count, desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { toMinorUnits } from '../common/money';
import { DRIZZLE } from '../db/db.constants';
import { category, operation, paymentMethod, scheduler } from '../db/schema';
import {
  TRANSFER_PAYMENT_METHOD_IDS,
  TransferService,
} from '../operations/transfer.service';
import { OwnershipService } from '../security/ownership.service';
import { requireMemberId } from '../session/require-member-id';
import { CreateSchedulerDto } from './dto/create-scheduler.dto';
import { UpdateSchedulerDto } from './dto/update-scheduler.dto';
import { SchedulerGenerationService } from './generation.service';

const PAGE_SIZE = 20;

@Injectable()
export class SchedulerService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly generation: SchedulerGenerationService,
    private readonly transfers: TransferService,
    private readonly ownership: OwnershipService,
  ) {}

  // Fully active = account and its bank are both neither closed nor
  // deleted. Required for creation and for editing/deleting an existing
  // scheduler; a scheduler on a merely-closed account stays listable-only.
  private requireFullyActive(row: {
    account: { closed: boolean; deleted: boolean };
    bank: { closed: boolean; deleted: boolean };
  }): void {
    if (
      row.account.closed ||
      row.account.deleted ||
      row.bank.closed ||
      row.bank.deleted
    ) {
      throw new UnprocessableEntityException('Account is not active.');
    }
  }

  // Validates the category/payment-method pair against the scheduler's
  // type, enforcing type-driven choice filtering server-side.
  private async validateTypedRefs(
    type: 'debit' | 'credit',
    paymentMethodId: number,
    categoryId?: number,
  ): Promise<void> {
    const [method] = await this.db
      .select()
      .from(paymentMethod)
      .where(eq(paymentMethod.id, paymentMethodId));
    if (!method || method.type !== type) {
      throw new BadRequestException('Invalid payment method for this type.');
    }
    if (categoryId !== undefined) {
      const [cat] = await this.db
        .select()
        .from(category)
        .where(eq(category.id, categoryId));
      if (!cat || cat.type !== type) {
        throw new BadRequestException('Invalid category for this type.');
      }
    }
  }

  private amountFields(
    type: 'debit' | 'credit',
    amount: number,
  ): { debit: number | null; credit: number | null } {
    const minorUnits = toMinorUnits(amount);
    return type === 'debit'
      ? { debit: minorUnits, credit: null }
      : { debit: null, credit: minorUnits };
  }

  private transferAccountId(
    paymentMethodId: number,
    transferAccountId?: number,
  ): number | null {
    return TRANSFER_PAYMENT_METHOD_IDS.includes(paymentMethodId)
      ? (transferAccountId ?? null)
      : null;
  }

  async list(req: Request, accountId: number, page: number) {
    const memberId = requireMemberId(req);
    await this.ownership.requireOwnedAccount(accountId, memberId);

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
    const owned = await this.ownership.requireOwnedAccount(
      dto.accountId,
      memberId,
    );
    this.requireFullyActive(owned);
    await this.validateTypedRefs(dto.type, dto.paymentMethodId, dto.categoryId);

    const { debit, credit } = this.amountFields(dto.type, dto.amount);
    const transferAccountId = this.transferAccountId(
      dto.paymentMethodId,
      dto.transferAccountId,
    );
    await this.transfers.validateSchedulerTarget(
      this.db,
      transferAccountId,
      null,
      dto.accountId,
      owned.account.currency,
      memberId,
    );

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
    // today, or in the past. Generation runs immediately after every save.
    await this.generation.generateForScheduler(
      this.db,
      memberId,
      created,
      owned.account,
      owned.bank,
    );

    return created;
  }

  async update(
    req: Request,
    id: number,
    dto: UpdateSchedulerDto,
  ): Promise<void> {
    const memberId = requireMemberId(req);
    const owned = await this.ownership.requireOwnedScheduler(id, memberId);
    this.requireFullyActive(owned);
    if (dto.accountId !== owned.scheduler.accountId) {
      throw new BadRequestException('Account cannot be changed.');
    }
    await this.validateTypedRefs(dto.type, dto.paymentMethodId, dto.categoryId);

    const { debit, credit } = this.amountFields(dto.type, dto.amount);
    const transferAccountId = this.transferAccountId(
      dto.paymentMethodId,
      dto.transferAccountId,
    );
    await this.transfers.validateSchedulerTarget(
      this.db,
      transferAccountId,
      owned.scheduler.transferAccountId,
      owned.scheduler.accountId,
      owned.account.currency,
      memberId,
    );

    const [updated] = await this.db
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
      .where(eq(scheduler.id, id))
      .returning();

    // Editing a scheduler (e.g. changing its value date, interval, or
    // flipping it active) can bring new occurrences into range; generation
    // runs immediately after every save.
    await this.generation.generateForScheduler(
      this.db,
      memberId,
      updated,
      owned.account,
      owned.bank,
    );
  }

  async remove(req: Request, id: number): Promise<void> {
    const memberId = requireMemberId(req);
    const owned = await this.ownership.requireOwnedScheduler(id, memberId);
    this.requireFullyActive(owned);

    await this.db.transaction(async (tx) => {
      // Already-generated operations survive deletion; only their link to
      // this scheduler is dropped.
      await tx
        .update(operation)
        .set({ schedulerId: null })
        .where(eq(operation.schedulerId, id));
      await tx.delete(scheduler).where(eq(scheduler.id, id));
    });
  }
}

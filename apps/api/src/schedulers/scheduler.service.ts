import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { count, desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { toMinorUnits } from '../common/money';
import { DRIZZLE } from '../db/db.constants';
import {
  account,
  bank,
  category,
  operation,
  paymentMethod,
  scheduler,
} from '../db/schema';
import { TRANSFER_PAYMENT_METHOD_IDS } from '../operations/transfer.service';
import '../session/session-data';
import { CreateSchedulerDto } from './dto/create-scheduler.dto';
import { UpdateSchedulerDto } from './dto/update-scheduler.dto';

const PAGE_SIZE = 20;

@Injectable()
export class SchedulerService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  private requireMemberId(req: Request): number {
    const memberId = req.session.memberId;
    if (!memberId) {
      throw new UnauthorizedException();
    }
    return memberId;
  }

  // Ownership check always runs before any lifecycle-state check. An
  // account of a deleted bank, or a deleted account itself, is unreachable
  // — "not found" — even for the owner; closed accounts remain reachable
  // (listable-only, enforced by callers where creation/editing applies).
  private async findOwnedAccount(accountId: number, memberId: number) {
    const [row] = await this.db
      .select({ account, bank })
      .from(account)
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(eq(account.id, accountId));
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

  private async findOwnedScheduler(id: number, memberId: number) {
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
    const memberId = this.requireMemberId(req);
    await this.findOwnedAccount(accountId, memberId);

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
    const memberId = this.requireMemberId(req);
    const owned = await this.findOwnedAccount(dto.accountId, memberId);
    this.requireFullyActive(owned);
    await this.validateTypedRefs(dto.type, dto.paymentMethodId, dto.categoryId);

    const { debit, credit } = this.amountFields(dto.type, dto.amount);
    const transferAccountId = this.transferAccountId(
      dto.paymentMethodId,
      dto.transferAccountId,
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

    return created;
  }

  async update(
    req: Request,
    id: number,
    dto: UpdateSchedulerDto,
  ): Promise<void> {
    const memberId = this.requireMemberId(req);
    const owned = await this.findOwnedScheduler(id, memberId);
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
  }

  async remove(req: Request, id: number): Promise<void> {
    const memberId = this.requireMemberId(req);
    const owned = await this.findOwnedScheduler(id, memberId);
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

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
} from '../db/schema';
import '../session/session-data';
import { CreateOperationDto } from './dto/create-operation.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';

// Payment method id 9, "Initial balance", reserved for the
// system-generated opening operation — non-editable.
const OPENING_BALANCE_PAYMENT_METHOD_ID = 9;
// Ids 4 (debit) and 6 (credit) are the transfer payment methods.
const TRANSFER_PAYMENT_METHOD_IDS = [4, 6];

const PAGE_SIZE = 20;

@Injectable()
export class OperationService {
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

  private async findOwnedOperation(id: number, memberId: number) {
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

  private requireActive(row: { closed: boolean; deleted: boolean }): void {
    if (row.closed || row.deleted) {
      throw new UnprocessableEntityException('Account is not active.');
    }
  }

  // Validates the category/payment-method pair against the operation's
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
      .from(operation)
      .where(eq(operation.accountId, accountId))
      .orderBy(
        desc(operation.valueDate),
        desc(operation.createdAt),
        desc(operation.id),
      )
      .limit(PAGE_SIZE)
      .offset((pageNumber - 1) * PAGE_SIZE);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(operation)
      .where(eq(operation.accountId, accountId));

    return { items: rows, total, page: pageNumber, pageSize: PAGE_SIZE };
  }

  async create(req: Request, dto: CreateOperationDto) {
    const memberId = this.requireMemberId(req);
    const { account: acc } = await this.findOwnedAccount(
      dto.accountId,
      memberId,
    );
    this.requireActive(acc);
    await this.validateTypedRefs(dto.type, dto.paymentMethodId, dto.categoryId);

    const { debit, credit } = this.amountFields(dto.type, dto.amount);

    const [created] = await this.db
      .insert(operation)
      .values({
        accountId: dto.accountId,
        thirdParty: dto.thirdParty,
        debit,
        credit,
        categoryId: dto.categoryId,
        paymentMethodId: dto.paymentMethodId,
        transferAccountId: this.transferAccountId(
          dto.paymentMethodId,
          dto.transferAccountId,
        ),
        ...(dto.valueDate ? { valueDate: dto.valueDate } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.reconciled !== undefined ? { reconciled: dto.reconciled } : {}),
      })
      .returning();

    return created;
  }

  async update(
    req: Request,
    id: number,
    dto: UpdateOperationDto,
  ): Promise<void> {
    const memberId = this.requireMemberId(req);
    const { operation: row, account: acc } = await this.findOwnedOperation(
      id,
      memberId,
    );
    this.requireActive(acc);
    if (dto.accountId !== row.accountId) {
      throw new BadRequestException('Account cannot be changed.');
    }
    if (row.paymentMethodId === OPENING_BALANCE_PAYMENT_METHOD_ID) {
      throw new UnprocessableEntityException(
        'Opening operation cannot be edited.',
      );
    }
    await this.validateTypedRefs(dto.type, dto.paymentMethodId, dto.categoryId);

    const { debit, credit } = this.amountFields(dto.type, dto.amount);

    await this.db
      .update(operation)
      .set({
        thirdParty: dto.thirdParty,
        debit,
        credit,
        categoryId: dto.categoryId ?? null,
        paymentMethodId: dto.paymentMethodId,
        transferAccountId: this.transferAccountId(
          dto.paymentMethodId,
          dto.transferAccountId,
        ),
        valueDate: dto.valueDate,
        notes: dto.notes ?? '',
        reconciled: dto.reconciled ?? false,
      })
      .where(eq(operation.id, id));
  }
}

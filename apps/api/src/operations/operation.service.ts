import {
  BadRequestException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
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
} from './entry-rules';
import { operation } from '../db/schema';
import { PAYMENT_METHOD_ID } from '../db/seed-data';
import { AccountId, OperationId } from '../security/ids';
import { OwnershipService } from '../security/ownership.service';
import { requireMemberId } from '../session/require-member-id';
import { CreateOperationDto } from './dto/create-operation.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';
import { TransferService } from './transfer.service';

// The "Initial balance" payment method, reserved for the system-generated
// opening operation — non-editable.
const OPENING_BALANCE_PAYMENT_METHOD_ID = PAYMENT_METHOD_ID.INITIAL_BALANCE;

@Injectable()
export class OperationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly transfers: TransferService,
    private readonly ownership: OwnershipService,
  ) {}

  async list(req: Request, accountId: string, page: number) {
    const memberId = requireMemberId(req);
    await this.ownership.requireOwnedAccount(accountId as AccountId, memberId);

    const pageNumber = page > 0 ? page : 1;
    const rows = await this.db
      .select()
      .from(operation)
      .where(eq(operation.accountId, accountId))
      .orderBy(desc(operation.valueDate), desc(operation.createdAt), desc(operation.id))
      .limit(PAGE_SIZE)
      .offset((pageNumber - 1) * PAGE_SIZE);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(operation)
      .where(eq(operation.accountId, accountId));

    return { items: rows, total, page: pageNumber, pageSize: PAGE_SIZE };
  }

  async create(req: Request, dto: CreateOperationDto) {
    const memberId = requireMemberId(req);
    const { account: acc, bank: accBank } = await this.ownership.requireOwnedAccount(
      dto.accountId as AccountId,
      memberId,
    );
    requireFullyActive({ account: acc, bank: accBank });
    await validateTypedRefs(this.db, dto.type, dto.paymentMethodId, dto.categoryId);

    const { debit, credit } = amountFields(dto.type, dto.amount);
    const transferAccountId = transferAccountIdFor(dto.paymentMethodId, dto.transferAccountId);

    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(operation)
        .values({
          accountId: dto.accountId,
          thirdParty: dto.thirdParty,
          debit,
          credit,
          categoryId: dto.categoryId,
          paymentMethodId: dto.paymentMethodId,
          transferAccountId,
          ...(dto.valueDate ? { valueDate: dto.valueDate } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.reconciled !== undefined ? { reconciled: dto.reconciled } : {}),
        })
        .returning();

      // A transfer target was chosen: pair the operation with a mirror in
      // the target account (see transfer.service.ts for the rules). A
      // fresh operation can never have prior pairing state, so this is
      // always an attach — never sync()'s fuller reconcile.
      if (transferAccountId !== null) {
        const transferOperationId = await this.transfers.attach(
          tx,
          {
            sourceOperationId: created.id,
            sourceAccountId: created.accountId,
            sourceCurrency: acc.currency,
            memberId,
          },
          transferAccountId,
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
        await tx.update(operation).set({ transferOperationId }).where(eq(operation.id, created.id));
        created.transferOperationId = transferOperationId;
      }

      return created;
    });
  }

  async update(req: Request, id: string, dto: UpdateOperationDto): Promise<void> {
    const memberId = requireMemberId(req);
    const {
      operation: row,
      account: acc,
      bank: accBank,
    } = await this.ownership.requireOwnedOperation(id as OperationId, memberId);
    requireFullyActive({ account: acc, bank: accBank });
    if (dto.accountId !== row.accountId) {
      throw new BadRequestException('Account cannot be changed.');
    }
    if (row.paymentMethodId === OPENING_BALANCE_PAYMENT_METHOD_ID) {
      throw new UnprocessableEntityException('Opening operation cannot be edited.');
    }
    await validateTypedRefs(this.db, dto.type, dto.paymentMethodId, dto.categoryId);

    const { debit, credit } = amountFields(dto.type, dto.amount);
    const desiredTransferAccountId = transferAccountIdFor(
      dto.paymentMethodId,
      dto.transferAccountId,
    );
    const notes = dto.notes ?? '';
    const reconciled = dto.reconciled ?? false;

    await this.db.transaction(async (tx) => {
      // Resolved from the pairing state stored before this save — creates,
      // updates, retargets or removes the mirror as needed (see
      // transfer.service.ts).
      const transferOperationId = await this.transfers.sync(
        tx,
        {
          sourceOperationId: id,
          sourceAccountId: row.accountId,
          sourceCurrency: acc.currency,
          memberId,
        },
        {
          targetAccountId: row.transferAccountId,
          mirrorOperationId: row.transferOperationId,
        },
        desiredTransferAccountId,
        {
          paymentMethodId: dto.paymentMethodId,
          debit,
          credit,
          thirdParty: dto.thirdParty,
          valueDate: dto.valueDate,
          notes,
          schedulerId: row.schedulerId,
        },
      );

      await tx
        .update(operation)
        .set({
          thirdParty: dto.thirdParty,
          debit,
          credit,
          categoryId: dto.categoryId ?? null,
          paymentMethodId: dto.paymentMethodId,
          transferAccountId: desiredTransferAccountId,
          transferOperationId,
          valueDate: dto.valueDate,
          notes,
          reconciled,
        })
        .where(eq(operation.id, id));
    });
  }
}

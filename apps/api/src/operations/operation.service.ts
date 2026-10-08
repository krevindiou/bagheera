import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BusinessError } from '../common/filters/business-error';
import { DRIZZLE } from '../db/db.constants';
import {
  accountCannotBeChanged,
  amountFields,
  OPENING_BALANCE_PAYMENT_METHOD_ID,
  requireFullyActive,
  requireFullyActiveLocked,
  transferAccountIdFor,
  validateTypedRefs,
} from './entry-rules';
import { operation } from '../db/schema';
import { MemberId, AccountId, OperationId } from '../security/ids';
import { OwnershipService } from '../security/ownership.service';
import { CreateOperationDto } from './dto/create-operation.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';
import { TransferService } from './transfer.service';

@Injectable()
export class OperationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly transfers: TransferService,
    private readonly ownership: OwnershipService,
  ) {}

  async create(memberId: MemberId, dto: CreateOperationDto) {
    const { account: acc, bank: accBank } = await this.ownership.requireOwnedAccount(
      dto.accountId as AccountId,
      memberId,
    );
    requireFullyActive({ account: acc, bank: accBank });
    await validateTypedRefs(this.db, dto.type, dto.paymentMethodId, dto.categoryId);

    const { debit, credit } = amountFields(dto.type, dto.amount);
    const transferAccountId = transferAccountIdFor(dto.paymentMethodId, dto.transferAccountId);

    return this.db.transaction(async (tx) => {
      await requireFullyActiveLocked(tx, dto.accountId as AccountId);

      const created = await this.transfers.insertWithMirror(
        tx,
        {
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
        },
        {
          sourceCurrency: acc.currency,
          memberId,
        },
      );

      return created;
    });
  }

  async update(memberId: MemberId, id: string, dto: UpdateOperationDto): Promise<void> {
    const {
      operation: row,
      account: acc,
      bank: accBank,
    } = await this.ownership.requireOwnedOperation(id as OperationId, memberId);
    requireFullyActive({ account: acc, bank: accBank });
    if (dto.accountId !== row.accountId) {
      throw accountCannotBeChanged();
    }
    if (row.paymentMethodId === OPENING_BALANCE_PAYMENT_METHOD_ID) {
      throw new BusinessError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'opening_operation_locked',
        'Opening operation cannot be edited.',
      );
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
      await requireFullyActiveLocked(tx, dto.accountId as AccountId);

      // Pairing state comes from the locked row.
      const [lockedOp] = await tx
        .select()
        .from(operation)
        .where(eq(operation.id, id))
        .for('update');

      if (!lockedOp) {
        throw new BusinessError(
          HttpStatus.NOT_FOUND,
          'operation_not_found',
          'Operation not found.',
        );
      }

      const transferOperationId = await this.transfers.sync(
        tx,
        {
          sourceOperationId: id,
          sourceAccountId: lockedOp.accountId,
          sourceCurrency: acc.currency,
          memberId,
        },
        {
          targetAccountId: lockedOp.transferAccountId,
          mirrorOperationId: lockedOp.transferOperationId,
        },
        desiredTransferAccountId,
        {
          paymentMethodId: dto.paymentMethodId,
          debit,
          credit,
          thirdParty: dto.thirdParty,
          valueDate: dto.valueDate,
          notes,
          schedulerId: lockedOp.schedulerId,
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

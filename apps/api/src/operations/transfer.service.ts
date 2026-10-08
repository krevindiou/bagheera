import { HttpStatus, Injectable } from '@nestjs/common';
import { and, eq, inArray, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BusinessError } from '../common/filters/business-error';
import { MinorUnits } from '../common/money';
import type { Executor } from '../db/executor';
import { TRANSFER_PAYMENT_METHOD_IDS } from '@bagheera/reference-data';
import { account, bank, operation, scheduler } from '../db/schema';
import { PAYMENT_METHOD_ID } from '../db/seed-data';
import { MemberId } from '../security/ids';
import { isFullyActive, reachableAccountsOf } from '../security/reachable';

// The "Transfer" debit/credit payment methods, the only two that can carry
// a pairing; a mirror flips one into the other.
export { TRANSFER_PAYMENT_METHOD_IDS };
export const TRANSFER_DEBIT_PAYMENT_METHOD_ID: string = PAYMENT_METHOD_ID.TRANSFER_DEBIT;
export const TRANSFER_CREDIT_PAYMENT_METHOD_ID: string = PAYMENT_METHOD_ID.TRANSFER_CREDIT;

// The db handle or an open transaction, so callers can run pairing side
// effects inside their own transaction.
type Db = NodePgDatabase | Executor;

// Facts needed to validate a *new* transfer target (attach or retarget) —
// nothing here depends on the source operation already existing.
export interface PairingEligibility {
  sourceAccountId: string;
  sourceCurrency: string;
  memberId: string;
}

// Adds the source operation's id, for a new mirror's back-reference.
export interface PairingSource extends PairingEligibility {
  sourceOperationId: string;
}

// The mirror's content, given as the *source's* values: attach/sync flip
// the payment method and swap debit/credit themselves. `reconciled` is
// excluded: a mirror never inherits it.
export interface MirrorContent {
  paymentMethodId: string;
  debit: MinorUnits | null;
  credit: MinorUnits | null;
  thirdParty: string;
  valueDate: string;
  notes: string;
  schedulerId: string | null;
}

// The source row's pairing before this save: both null or both set.
export interface PreviousPairing {
  targetAccountId: string | null;
  mirrorOperationId: string | null;
}

export type PairingEdit =
  | { action: 'none' }
  | { action: 'attach'; targetAccountId: string }
  | { action: 'retarget'; mirrorOperationId: string; targetAccountId: string }
  | { action: 'refresh'; mirrorOperationId: string }
  | { action: 'detach'; mirrorOperationId: string };

// Pure: classifies previous-vs-desired pairing into one transition.
export function classifyPairingEdit(
  previous: PreviousPairing,
  desiredTargetAccountId: string | null,
): PairingEdit {
  if (desiredTargetAccountId === null) {
    return previous.mirrorOperationId !== null
      ? { action: 'detach', mirrorOperationId: previous.mirrorOperationId }
      : { action: 'none' };
  }
  if (previous.mirrorOperationId !== null && previous.targetAccountId === desiredTargetAccountId) {
    return { action: 'refresh', mirrorOperationId: previous.mirrorOperationId };
  }
  return previous.mirrorOperationId !== null
    ? {
        action: 'retarget',
        mirrorOperationId: previous.mirrorOperationId,
        targetAccountId: desiredTargetAccountId,
      }
    : { action: 'attach', targetAccountId: desiredTargetAccountId };
}

@Injectable()
export class TransferService {
  mirrorContentOf(row: InferSelectModel<typeof operation>): MirrorContent {
    return {
      paymentMethodId: row.paymentMethodId,
      debit: row.debit,
      credit: row.credit,
      thirdParty: row.thirdParty,
      valueDate: row.valueDate,
      notes: row.notes,
      schedulerId: row.schedulerId,
    };
  }

  // Inserts an operation and, when it has a transferAccountId, attaches a
  // mirror and back-fills the row's transferOperationId. Shared by
  // operation creation and scheduler generation.
  async insertWithMirror(
    db: Db,
    values: InferInsertModel<typeof operation>,
    source: { sourceCurrency: string; memberId: string },
  ): Promise<InferSelectModel<typeof operation>> {
    const [created] = await db.insert(operation).values(values).returning();

    if (values.transferAccountId) {
      const transferOperationId = await this.attach(
        db,
        {
          sourceOperationId: created.id,
          sourceAccountId: created.accountId,
          sourceCurrency: source.sourceCurrency,
          memberId: source.memberId,
        },
        values.transferAccountId,
        this.mirrorContentOf(created),
      );
      await db.update(operation).set({ transferOperationId }).where(eq(operation.id, created.id));
      created.transferOperationId = transferOperationId;
    }

    return created;
  }

  isTransferMethod(paymentMethodId: string): boolean {
    return TRANSFER_PAYMENT_METHOD_IDS.includes(paymentMethodId);
  }

  private flip(paymentMethodId: string): string {
    return paymentMethodId === TRANSFER_DEBIT_PAYMENT_METHOD_ID
      ? TRANSFER_CREDIT_PAYMENT_METHOD_ID
      : TRANSFER_DEBIT_PAYMENT_METHOD_ID;
  }

  // A *new* target (attach or retarget) must be another fully active
  // account of the same member, in the source's currency. An existing
  // target that went inactive is never re-checked (see 'refresh').
  //
  // Runs on the caller's `db` (often a transaction), not OwnershipService,
  // and throws 400s, which callers surface as form-field errors.
  private async requireEligibleTarget(
    db: Db,
    targetAccountId: string,
    source: PairingEligibility,
  ): Promise<void> {
    if (targetAccountId === source.sourceAccountId) {
      throw new BusinessError(
        HttpStatus.BAD_REQUEST,
        'transfer_same_account',
        'Cannot transfer to the same account.',
      );
    }
    const [row] = await db
      .select({ account, bank })
      .from(account)
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(
        and(eq(account.id, targetAccountId), reachableAccountsOf(db, source.memberId as MemberId)),
      );
    if (!row) {
      throw new BusinessError(
        HttpStatus.BAD_REQUEST,
        'transfer_account_invalid',
        'Invalid transfer account.',
      );
    }
    if (!isFullyActive(row.account, row.bank)) {
      throw new BusinessError(
        HttpStatus.BAD_REQUEST,
        'transfer_account_not_active',
        'Transfer account is not active.',
      );
    }
    if (row.account.currency !== source.sourceCurrency) {
      throw new BusinessError(
        HttpStatus.BAD_REQUEST,
        'transfer_currency_mismatch',
        'Transfer account currency mismatch.',
      );
    }
  }

  private mirrorFieldsFrom(content: MirrorContent) {
    return {
      paymentMethodId: this.flip(content.paymentMethodId),
      debit: content.credit,
      credit: content.debit,
      thirdParty: content.thirdParty,
      valueDate: content.valueDate,
      notes: content.notes,
      schedulerId: content.schedulerId,
    };
  }

  // Validates the target and inserts a new mirror pointing back at the
  // source. Never writes the source row: the caller persists the returned
  // id. Only for a source with no mirror yet; otherwise use sync().
  async attach(
    db: Db,
    source: PairingSource,
    targetAccountId: string,
    content: MirrorContent,
  ): Promise<string> {
    await this.requireEligibleTarget(db, targetAccountId, source);
    const [mirror] = await db
      .insert(operation)
      .values({
        accountId: targetAccountId,
        transferAccountId: source.sourceAccountId,
        transferOperationId: source.sourceOperationId,
        reconciled: false,
        ...this.mirrorFieldsFrom(content),
      })
      .returning();
    return mirror.id;
  }

  // Applies an edit's pairing transition. Never writes the source row
  // (except to unlink on detach): the caller persists the returned
  // transferOperationId and `desiredTargetAccountId` with its other fields.
  async sync(
    db: Db,
    source: PairingSource,
    previous: PreviousPairing,
    desiredTargetAccountId: string | null,
    content: MirrorContent,
  ): Promise<string | null> {
    const edit = classifyPairingEdit(previous, desiredTargetAccountId);
    switch (edit.action) {
      case 'none':
        return null;

      case 'detach':
        // The source row's own transferOperationId still points at the
        // mirror until the caller persists its save; clear it first or the
        // FK blocks the mirror's deletion.
        await db
          .update(operation)
          .set({ transferOperationId: null, transferAccountId: null })
          .where(eq(operation.id, source.sourceOperationId));
        await db.delete(operation).where(eq(operation.id, edit.mirrorOperationId));
        return null;

      case 'refresh':
        // Same target: sync content only, with no eligibility re-check.
        await db
          .update(operation)
          .set(this.mirrorFieldsFrom(content))
          .where(eq(operation.id, edit.mirrorOperationId));
        return edit.mirrorOperationId;

      case 'retarget':
        await this.requireEligibleTarget(db, edit.targetAccountId, source);
        await db
          .update(operation)
          .set({
            ...this.mirrorFieldsFrom(content),
            accountId: edit.targetAccountId,
          })
          .where(eq(operation.id, edit.mirrorOperationId));
        return edit.mirrorOperationId;

      case 'attach':
        return this.attach(db, source, edit.targetAccountId, content);
    }
  }

  // A scheduler has no mirror, so only a new target is checked; `null` or
  // an unchanged one is a no-op, as in sync()'s 'refresh'.
  async validateSchedulerTarget(
    db: Db,
    source: PairingEligibility,
    previous: Pick<PreviousPairing, 'targetAccountId'>,
    desiredTargetAccountId: string | null,
  ): Promise<void> {
    if (desiredTargetAccountId === null || desiredTargetAccountId === previous.targetAccountId) {
      return;
    }
    await this.requireEligibleTarget(db, desiredTargetAccountId, source);
  }

  // A deleted operation's surviving counterpart becomes an External
  // transfer (link and transfer account cleared). Run before the delete,
  // in the same transaction.
  async convertSurvivorsOfDeleted(db: Db, deletedIds: string[]): Promise<void> {
    if (deletedIds.length === 0) {
      return;
    }
    const rows = await db
      .select({ transferOperationId: operation.transferOperationId })
      .from(operation)
      .where(inArray(operation.id, deletedIds));
    const mirrorIds = rows
      .map((row) => row.transferOperationId)
      .filter((id): id is string => id !== null && !deletedIds.includes(id));
    if (mirrorIds.length > 0) {
      await db
        .update(operation)
        .set({ transferAccountId: null, transferOperationId: null })
        .where(inArray(operation.id, mirrorIds));
    }
  }

  // Soft-deleting an account turns every operation/scheduler transfer
  // reference to it into External, irreversibly.
  async convertAccountReferencesToExternal(db: Db, accountId: string): Promise<void> {
    await db
      .update(operation)
      .set({ transferAccountId: null, transferOperationId: null })
      .where(eq(operation.transferAccountId, accountId));
    await db
      .update(scheduler)
      .set({ transferAccountId: null })
      .where(eq(scheduler.transferAccountId, accountId));
  }

  // Same conversion, applied to every account of a bank being deleted.
  async convertBankReferencesToExternal(db: Db, bankId: string): Promise<void> {
    const accounts = await db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.bankId, bankId));
    const accountIds = accounts.map((a) => a.id);
    if (accountIds.length === 0) {
      return;
    }
    await db
      .update(operation)
      .set({ transferAccountId: null, transferOperationId: null })
      .where(inArray(operation.transferAccountId, accountIds));
    await db
      .update(scheduler)
      .set({ transferAccountId: null })
      .where(inArray(scheduler.transferAccountId, accountIds));
  }
}

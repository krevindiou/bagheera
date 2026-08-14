import { BadRequestException, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { account, bank, operation, scheduler } from '../db/schema';

// Payment method ids 4 (debit) and 6 (credit) — the only two payment
// methods that can carry a pairing; flipping between them mirrors a
// transfer from one side to the other.
export const TRANSFER_DEBIT_PAYMENT_METHOD_ID = 4;
export const TRANSFER_CREDIT_PAYMENT_METHOD_ID = 6;
export const TRANSFER_PAYMENT_METHOD_IDS = [
  TRANSFER_DEBIT_PAYMENT_METHOD_ID,
  TRANSFER_CREDIT_PAYMENT_METHOD_ID,
];

// Any object exposing the query-builder surface: the plain db handle or an
// open transaction — every method below accepts either so callers can chain
// pairing side effects into their own transaction.
type Executor = Parameters<NodePgDatabase['transaction']>[0] extends (
  tx: infer T,
) => unknown
  ? T
  : never;
type Db = NodePgDatabase | Executor;

export interface SyncPairingInput {
  sourceId: number;
  sourceAccountId: number;
  sourceCurrency: string;
  memberId: number;
  // Pairing state stored on the source row before this save (null on
  // create, or when the source was never paired).
  previousTransferAccountId: number | null;
  previousTransferOperationId: number | null;
  // Pairing state requested by this save; null means "no target chosen" —
  // covers both a non-transfer payment method and the External placeholder.
  desiredTransferAccountId: number | null;
  paymentMethodId: number;
  debit: number | null;
  credit: number | null;
  thirdParty: string;
  valueDate: string;
  notes: string;
  schedulerId: number | null;
}

@Injectable()
export class TransferService {
  isTransferMethod(paymentMethodId: number): boolean {
    return TRANSFER_PAYMENT_METHOD_IDS.includes(paymentMethodId);
  }

  private flip(paymentMethodId: number): number {
    return paymentMethodId === TRANSFER_DEBIT_PAYMENT_METHOD_ID
      ? TRANSFER_CREDIT_PAYMENT_METHOD_ID
      : TRANSFER_DEBIT_PAYMENT_METHOD_ID;
  }

  // Only fully active accounts, owned by the same member and sharing the
  // source's currency, are eligible as a *new* transfer target — whether
  // that's a first-time pairing or a retarget. An operation's already-paired
  // target that has since gone inactive is left alone by the caller instead
  // of routed through here (see `sync`'s same-target branch).
  private async requireEligibleTarget(
    db: Db,
    targetAccountId: number,
    sourceAccountId: number,
    sourceCurrency: string,
    memberId: number,
  ): Promise<void> {
    if (targetAccountId === sourceAccountId) {
      throw new BadRequestException('Cannot transfer to the same account.');
    }
    const [row] = await db
      .select({ account, bank })
      .from(account)
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(eq(account.id, targetAccountId));
    if (!row || row.bank.memberId !== memberId) {
      throw new BadRequestException('Invalid transfer account.');
    }
    if (
      row.bank.deleted ||
      row.account.deleted ||
      row.bank.closed ||
      row.account.closed
    ) {
      throw new BadRequestException('Transfer account is not active.');
    }
    if (row.account.currency !== sourceCurrency) {
      throw new BadRequestException('Transfer account currency mismatch.');
    }
  }

  // Creates, updates, retargets or removes the mirror operation of a
  // transfer pair so the source row (still to be persisted by the caller)
  // ends up consistent with it. Returns the `transferOperationId` the
  // caller should store on the source row.
  async sync(db: Db, input: SyncPairingInput): Promise<number | null> {
    if (input.desiredTransferAccountId === null) {
      if (input.previousTransferOperationId) {
        // The source row's own transferOperationId still points at the
        // mirror until the caller persists it; clear it first or the FK
        // blocks the mirror's deletion.
        await db
          .update(operation)
          .set({ transferOperationId: null, transferAccountId: null })
          .where(eq(operation.id, input.sourceId));
        await db
          .delete(operation)
          .where(eq(operation.id, input.previousTransferOperationId));
      }
      return null;
    }

    const mirrorFields = {
      paymentMethodId: this.flip(input.paymentMethodId),
      debit: input.credit,
      credit: input.debit,
      thirdParty: input.thirdParty,
      valueDate: input.valueDate,
      notes: input.notes,
      schedulerId: input.schedulerId,
    };

    // Same target as before: the mirror is reused in place, syncing fields
    // only — no eligibility re-check, since a paired target that went
    // inactive after the fact stays syncable (only *new* targets require
    // active state).
    if (
      input.previousTransferOperationId &&
      input.previousTransferAccountId === input.desiredTransferAccountId
    ) {
      await db
        .update(operation)
        .set(mirrorFields)
        .where(eq(operation.id, input.previousTransferOperationId));
      return input.previousTransferOperationId;
    }

    await this.requireEligibleTarget(
      db,
      input.desiredTransferAccountId,
      input.sourceAccountId,
      input.sourceCurrency,
      input.memberId,
    );

    if (input.previousTransferOperationId) {
      await db
        .update(operation)
        .set({ ...mirrorFields, accountId: input.desiredTransferAccountId })
        .where(eq(operation.id, input.previousTransferOperationId));
      return input.previousTransferOperationId;
    }

    const [mirror] = await db
      .insert(operation)
      .values({
        accountId: input.desiredTransferAccountId,
        transferAccountId: input.sourceAccountId,
        transferOperationId: input.sourceId,
        reconciled: false,
        ...mirrorFields,
      })
      .returning();
    return mirror.id;
  }

  // Deleting an operation leaves any counterpart in place, converted to an
  // External transfer: pair link removed, transfer account cleared. Ids
  // whose mirror is itself among the deleted ids need no such fix-up — both
  // sides are gone. Must run before the deletion itself, in the same
  // transaction.
  async convertSurvivorsOfDeleted(db: Db, deletedIds: number[]): Promise<void> {
    if (deletedIds.length === 0) {
      return;
    }
    const rows = await db
      .select({ transferOperationId: operation.transferOperationId })
      .from(operation)
      .where(inArray(operation.id, deletedIds));
    const mirrorIds = rows
      .map((row) => row.transferOperationId)
      .filter((id): id is number => id !== null && !deletedIds.includes(id));
    if (mirrorIds.length > 0) {
      await db
        .update(operation)
        .set({ transferAccountId: null, transferOperationId: null })
        .where(inArray(operation.id, mirrorIds));
    }
  }

  // Soft-deleting an account converts every transfer reference pointing at
  // it — on other accounts' operations and schedulers — to the External
  // placeholder: a one-time, irreversible conversion at deletion time.
  async convertAccountReferencesToExternal(
    db: Db,
    accountId: number,
  ): Promise<void> {
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
  async convertBankReferencesToExternal(db: Db, bankId: number): Promise<void> {
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

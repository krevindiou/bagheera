import { BadRequestException, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { MinorUnits } from '../common/money';
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

// Facts needed to validate a *new* transfer target (attach or retarget) —
// nothing here depends on the source operation already existing.
export interface PairingEligibility {
  sourceAccountId: number;
  sourceCurrency: string;
  memberId: number;
}

// Adds the source operation's own id, needed to stamp a brand-new mirror's
// back-reference — only attach()/sync() ever create a mirror, so only they
// need this; validateSchedulerTarget (no row to reference) doesn't.
export interface PairingSource extends PairingEligibility {
  sourceOperationId: number;
}

// The mirror's own editable content: everything about the transfer that
// isn't the pairing relationship itself. Callers pass the *source's* own
// values here — attach/sync flip the payment method and swap debit/credit
// internally; never pre-flip them yourself. `reconciled` is deliberately
// excluded: a mirror's reconciled state is never inherited from the source.
export interface MirrorContent {
  paymentMethodId: number;
  debit: MinorUnits | null;
  credit: MinorUnits | null;
  thirdParty: string;
  valueDate: string;
  notes: string;
  schedulerId: number | null;
}

// The pairing state stored on the source row before this save. Both null
// when the source has never been paired; both set otherwise — never mixed,
// on any row this module itself wrote.
export interface PreviousPairing {
  targetAccountId: number | null;
  mirrorOperationId: number | null;
}

export type PairingEdit =
  | { action: 'none' }
  | { action: 'attach'; targetAccountId: number }
  | { action: 'retarget'; mirrorOperationId: number; targetAccountId: number }
  | { action: 'refresh'; mirrorOperationId: number }
  | { action: 'detach'; mirrorOperationId: number };

// Pure — no Db, no `this`. Classifies previous-vs-desired pairing state
// into the one transition it represents. Exported standalone so it's
// unit-testable with zero DB (see transfer-pairing.spec.ts), and so a
// future caller could inspect intent before acting on it (e.g. confirming
// before a retarget) without going through sync() itself.
export function classifyPairingEdit(
  previous: PreviousPairing,
  desiredTargetAccountId: number | null,
): PairingEdit {
  if (desiredTargetAccountId === null) {
    return previous.mirrorOperationId !== null
      ? { action: 'detach', mirrorOperationId: previous.mirrorOperationId }
      : { action: 'none' };
  }
  if (
    previous.mirrorOperationId !== null &&
    previous.targetAccountId === desiredTargetAccountId
  ) {
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
  // of routed through here (see sync()'s 'refresh' branch).
  private async requireEligibleTarget(
    db: Db,
    targetAccountId: number,
    source: PairingEligibility,
  ): Promise<void> {
    if (targetAccountId === source.sourceAccountId) {
      throw new BadRequestException('Cannot transfer to the same account.');
    }
    const [row] = await db
      .select({ account, bank })
      .from(account)
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(eq(account.id, targetAccountId));
    if (!row || row.bank.memberId !== source.memberId) {
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
    if (row.account.currency !== source.sourceCurrency) {
      throw new BadRequestException('Transfer account currency mismatch.');
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

  // Pairs `source` with a FRESH mirror in `targetAccountId` — always
  // validates the target first, then inserts the mirror (its own
  // transferOperationId pointing back at source.sourceOperationId). Never
  // writes the source row itself: the caller persists the returned id onto
  // its own transferOperationId column (its own transferAccountId it
  // already knows and sets itself). Call only when the source has no
  // existing mirror — use sync() instead when it might.
  async attach(
    db: Db,
    source: PairingSource,
    targetAccountId: number,
    content: MirrorContent,
  ): Promise<number> {
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

  // Reconciles an existing operation's transfer pairing against a newly
  // desired target — the only entry point that can hit all four
  // transitions a full edit can produce (classifyPairingEdit above decides
  // which). Never writes the source row: the caller must persist the
  // returned transferOperationId, and `desiredTargetAccountId` onto
  // transferAccountId, in the same write that saves the operation's other
  // edited fields.
  async sync(
    db: Db,
    source: PairingSource,
    previous: PreviousPairing,
    desiredTargetAccountId: number | null,
    content: MirrorContent,
  ): Promise<number | null> {
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
        await db
          .delete(operation)
          .where(eq(operation.id, edit.mirrorOperationId));
        return null;

      case 'refresh':
        // Same target as before: the mirror is reused in place, syncing
        // content only — no eligibility re-check, since a paired target
        // that went inactive after the fact stays syncable (only *new*
        // targets require active state).
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

  // Eligibility-only check for a scheduler template's transfer target — no
  // mirror row exists for a scheduler, so there's nothing to sync. `null`,
  // or unchanged from `previous.targetAccountId`, is always a no-op (an
  // unchanged target is left alone even if it's since gone inactive — same
  // rule as sync()'s 'refresh' branch).
  async validateSchedulerTarget(
    db: Db,
    source: PairingEligibility,
    previous: Pick<PreviousPairing, 'targetAccountId'>,
    desiredTargetAccountId: number | null,
  ): Promise<void> {
    if (
      desiredTargetAccountId === null ||
      desiredTargetAccountId === previous.targetAccountId
    ) {
      return;
    }
    await this.requireEligibleTarget(db, desiredTargetAccountId, source);
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

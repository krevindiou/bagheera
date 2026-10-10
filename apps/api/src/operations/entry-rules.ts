import { HttpStatus } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BusinessError } from '../common/filters/business-error';
import { MinorUnits, toMinorUnits } from '../common/money';
import { account, bank, category, paymentMethod } from '../db/schema';
import { PAYMENT_METHOD_ID } from '../db/seed-data';
import { AccountId } from '../security/ids';
import type { Executor } from '../db/executor';
import { isFullyActive } from '../security/reachable';
import { TRANSFER_PAYMENT_METHOD_IDS } from '@bagheera/reference-data';

export type EntryType = 'debit' | 'credit';

// Reserved for the system-generated opening operation.
export const OPENING_BALANCE_PAYMENT_METHOD_ID: string = PAYMENT_METHOD_ID.INITIAL_BALANCE;

// Rules shared by operations and schedulers, which are both "an entry on an
// account with a type, a payment method and a category".

// Required to create, edit, reconcile or delete an entry: one on a closed
// account or bank stays listable-only.
export function requireFullyActive(row: {
  account: { closed: boolean; deleted: boolean };
  bank: { closed: boolean; deleted: boolean };
}): void {
  if (!isFullyActive(row.account, row.bank)) {
    throw new BusinessError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'account_not_active',
      'Account is not active.',
    );
  }
}

// An entry's account is fixed at creation.
export function accountCannotBeChanged(): BusinessError {
  return new BusinessError(
    HttpStatus.BAD_REQUEST,
    'account_cannot_be_changed',
    'Account cannot be changed.',
  );
}

// Validates the category/payment-method pair against the entry's type,
// enforcing type-driven choice filtering server-side.
export async function validateTypedRefs(
  db: NodePgDatabase,
  type: EntryType,
  paymentMethodId: string,
  categoryId?: string,
): Promise<void> {
  const [method] = await db
    .select()
    .from(paymentMethod)
    .where(eq(paymentMethod.id, paymentMethodId));
  if (!method || method.type !== type) {
    throw new BusinessError(
      HttpStatus.BAD_REQUEST,
      'payment_method_invalid',
      'Invalid payment method for this type.',
    );
  }
  if (categoryId !== undefined) {
    const [cat] = await db.select().from(category).where(eq(category.id, categoryId));
    if (!cat || cat.type !== type) {
      throw new BusinessError(
        HttpStatus.BAD_REQUEST,
        'category_invalid',
        'Invalid category for this type.',
      );
    }
  }
}

export function amountFields(
  type: EntryType,
  amount: number,
): { debit: MinorUnits | null; credit: MinorUnits | null } {
  const minorUnits = toMinorUnits(amount);
  return type === 'debit'
    ? { debit: minorUnits, credit: null }
    : { debit: null, credit: minorUnits };
}

export function transferAccountIdFor(
  paymentMethodId: string,
  transferAccountId?: string,
): string | null {
  return TRANSFER_PAYMENT_METHOD_IDS.includes(paymentMethodId) ? (transferAccountId ?? null) : null;
}

// Locks the account and bank rows (FOR UPDATE) and re-checks they're fully
// active, inside the caller's transaction.
export async function requireFullyActiveLocked(
  tx: Executor,
  accountId: AccountId,
): Promise<{
  account: { closed: boolean; deleted: boolean };
  bank: { closed: boolean; deleted: boolean };
}> {
  const [row] = await tx
    .select({ account, bank })
    .from(account)
    .innerJoin(bank, eq(account.bankId, bank.id))
    .where(eq(account.id, accountId))
    .for('update');

  if (!row) {
    throw new BusinessError(HttpStatus.NOT_FOUND, 'account_not_found', 'Account not found.');
  }

  if (!isFullyActive(row.account, row.bank)) {
    throw new BusinessError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'account_not_active',
      'Account is not active.',
    );
  }

  return row;
}

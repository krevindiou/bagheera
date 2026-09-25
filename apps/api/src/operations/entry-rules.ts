import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { MinorUnits, toMinorUnits } from '../common/money';
import { category, paymentMethod } from '../db/schema';
import { TRANSFER_PAYMENT_METHOD_IDS } from './transfer.service';

export type EntryType = 'debit' | 'credit';

// Rules shared by operations and schedulers, which are both "an entry on an
// account with a type, a payment method and a category".

// Fully active = account and its bank are both neither closed nor deleted.
// Required for creating an entry and for editing/reconciling/deleting an
// existing one; an entry on a merely-closed account (or a closed bank)
// stays listable-only.
export function requireFullyActive(row: {
  account: { closed: boolean; deleted: boolean };
  bank: { closed: boolean; deleted: boolean };
}): void {
  if (row.account.closed || row.account.deleted || row.bank.closed || row.bank.deleted) {
    throw new UnprocessableEntityException('Account is not active.');
  }
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
    throw new BadRequestException('Invalid payment method for this type.');
  }
  if (categoryId !== undefined) {
    const [cat] = await db.select().from(category).where(eq(category.id, categoryId));
    if (!cat || cat.type !== type) {
      throw new BadRequestException('Invalid category for this type.');
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

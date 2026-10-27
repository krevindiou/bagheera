import { TRANSFER_PAYMENT_METHOD_IDS, type EntryType } from '@bagheera/reference-data';
import { normalizeLabel } from './labels';
import type { RowOutcome } from './types';

// How often the Member gave a payment method to operations of a third party
// and type, and the latest value date of those.
export interface MethodUse {
  type: EntryType;
  thirdParty: string;
  paymentMethodId: string;
  uses: number;
  lastDate: string;
}

// Gives each row whose payment method nothing named the one the Member used
// most for its third party and type, the most recent one on a tie.
export function withPaymentMethods(rows: RowOutcome[], usage: MethodUse[]): RowOutcome[] {
  const best = bestByKey(usage, (use) => use.paymentMethodId);
  return rows.map((row): RowOutcome => {
    if (row.status === 'invalid' || row.paymentMethodOrigin !== 'default') return row;
    const suggested = best.get(usageKey(row.type, row.thirdParty));
    return suggested
      ? { ...row, paymentMethodId: suggested.paymentMethodId, paymentMethodOrigin: 'history' }
      : row;
  });
}

// How often the Member gave a category to operations of a third party and
// type, and the latest value date of those.
export interface CategoryUse {
  type: EntryType;
  thirdParty: string;
  categoryId: string;
  uses: number;
  lastDate: string;
}

export function usageKey(type: EntryType, thirdParty: string): string {
  return `${type}|${normalizeLabel(thirdParty)}`;
}

// Gives each row the category the Member used most for its third party and
// type, the most recent one on a tie, unless the Member
// picked one, or none, for the line.
export function withCategories(
  rows: RowOutcome[],
  usage: CategoryUse[],
  picks: ReadonlyMap<number, string | null> = new Map(),
): RowOutcome[] {
  const best = bestByKey(usage, (use) => use.categoryId);
  return rows.map((row): RowOutcome => {
    if (row.status === 'invalid') return row;
    if (picks.has(row.line)) {
      const picked = picks.get(row.line) ?? null;
      return { ...row, categoryId: picked, categoryOrigin: picked === null ? null : 'picked' };
    }
    const suggested = best.get(usageKey(row.type, row.thirdParty));
    return suggested
      ? { ...row, categoryId: suggested.categoryId, categoryOrigin: 'history' }
      : row;
  });
}

// How often the Member's transfers of a third party and type, in the account
// imported into, went to or came from an account, and the latest value date.
export interface TransferUse {
  type: EntryType;
  thirdParty: string;
  accountId: string;
  uses: number;
  lastDate: string;
}

// The most used choice of each third party and type, the most recent on a
// tie, and the lowest id on a further tie so that the order the database
// answered in does not decide.
export function bestByKey<T extends CountedUse>(
  usage: T[],
  choice: (use: T) => string,
): Map<string, T> {
  const best = new Map<string, T>();
  for (const use of usage) {
    const key = usageKey(use.type, use.thirdParty);
    const current = best.get(key);
    if (!current || beats(use, current, choice)) best.set(key, use);
  }
  return best;
}

export interface CountedUse {
  type: EntryType;
  thirdParty: string;
  uses: number;
  lastDate: string;
}

function beats<T extends CountedUse>(use: T, current: T, choice: (use: T) => string): boolean {
  if (use.uses !== current.uses) return use.uses > current.uses;
  if (use.lastDate !== current.lastDate) return use.lastDate > current.lastDate;
  return choice(use) < choice(current);
}

// Gives a transfer row the account the Member used most for its third party
// and type, unless the Member picked one, or none, for the line.
// A row whose payment method is not a transfer one carries no account.
export function withTransfers(
  rows: RowOutcome[],
  usage: TransferUse[],
  picks: ReadonlyMap<number, string | null> = new Map(),
): RowOutcome[] {
  const best = bestByKey(usage, (use) => use.accountId);
  return rows.map((row): RowOutcome => {
    if (row.status === 'invalid' || !TRANSFER_PAYMENT_METHOD_IDS.includes(row.paymentMethodId)) {
      return row;
    }
    if (picks.has(row.line)) {
      const picked = picks.get(row.line) ?? null;
      return {
        ...row,
        transferAccountId: picked,
        transferAccountOrigin: picked === null ? null : 'picked',
      };
    }
    const suggested = best.get(usageKey(row.type, row.thirdParty));
    return suggested
      ? { ...row, transferAccountId: suggested.accountId, transferAccountOrigin: 'history' }
      : row;
  });
}

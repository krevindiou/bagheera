import { toMinorUnits } from '@bagheera/money';
import type { PreviewRow } from './import.types';

// Third-party problems a Member can fix by typing another label.
const FIXABLE_REASONS = new Set(['third_party_missing', 'third_party_too_long']);

export function canEditLabel(row: PreviewRow): boolean {
  return row.status !== 'invalid' || (row.reason !== null && FIXABLE_REASONS.has(row.reason));
}

// A skipped row whose recorded operation is not reconciled yet.
export function canReconcileRecorded(row: PreviewRow): boolean {
  return row.status === 'skipped' && row.recorded !== null && !row.recorded.reconciled;
}

export interface AccountFigures {
  balance: number;
  reconciledBalance: number;
}

// What the account's balance and reconciled balance become once the
// confirmation runs, in minor units: the rows to import (those of the file, and
// the skipped ones imported anyway) add to both when they are imported
// reconciled, the recorded operations reconciled add to the reconciled one.
export function projectBalances(
  current: AccountFigures,
  rows: PreviewRow[],
  choices: {
    included: ReadonlySet<number>;
    reconcileImported: boolean;
    reconcileLines: readonly number[];
  },
): AccountFigures {
  const reconcileLines = new Set(choices.reconcileLines);
  let balance: number = toMinorUnits(current.balance);
  let reconciledBalance: number = toMinorUnits(current.reconciledBalance);
  for (const row of rows) {
    if (row.status === 'invalid' || row.amount === null) continue;
    const signed = (row.type === 'credit' ? 1 : -1) * toMinorUnits(row.amount);
    const imported = row.status === 'import' || choices.included.has(row.line);
    if (imported) {
      balance += signed;
      if (choices.reconcileImported) reconciledBalance += signed;
    } else if (reconcileLines.has(row.line)) {
      reconciledBalance += signed;
    }
  }
  return { balance, reconciledBalance };
}

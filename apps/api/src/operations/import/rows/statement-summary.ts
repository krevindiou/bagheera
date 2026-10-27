import type { RowOutcome } from './types';

export interface StatementTotals {
  periodStart: string | null;
  periodEnd: string | null;
  // In minor units.
  debit: number;
  credit: number;
}

// The dates the valid rows of the file span and the sum of their debits and of
// their credits, whether they are imported or skipped.
export function totalsOf(rows: RowOutcome[]): StatementTotals {
  const totals: StatementTotals = { periodStart: null, periodEnd: null, debit: 0, credit: 0 };
  for (const row of rows) {
    if (row.status === 'invalid') continue;
    if (totals.periodStart === null || row.valueDate < totals.periodStart) {
      totals.periodStart = row.valueDate;
    }
    if (totals.periodEnd === null || row.valueDate > totals.periodEnd) {
      totals.periodEnd = row.valueDate;
    }
    totals[row.type] += row.amount;
  }
  return totals;
}

// What the rows to import add to the balance of the account on a date, in
// minor units: the skipped rows are in it already.
export function importedNetUpTo(rows: RowOutcome[], date: string): number {
  let net = 0;
  for (const row of rows) {
    if (row.status !== 'import' || row.valueDate > date) continue;
    net += row.type === 'credit' ? row.amount : -row.amount;
  }
  return net;
}

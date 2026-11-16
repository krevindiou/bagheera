import type { PreviewRow } from './import.types';
import { canEditLabel, canReconcileRecorded, projectBalances } from './importRows';

function row(overrides: Partial<PreviewRow>): PreviewRow {
  return {
    line: 1,
    status: 'import',
    reason: null,
    recorded: null,
    ...overrides,
  } as PreviewRow;
}

const recorded = (reconciled: boolean) =>
  ({ valueDate: '2026-03-05', thirdParty: 'Bakery', matchedBy: 'details', reconciled }) as const;

describe('canEditLabel', () => {
  it('allows a row that can be imported', () => {
    expect(canEditLabel(row({ status: 'import' }))).toBe(true);
    expect(canEditLabel(row({ status: 'skipped' }))).toBe(true);
  });

  it.each(['third_party_missing', 'third_party_too_long'] as const)(
    'allows an invalid row whose problem is its third party (%s)',
    (reason) => {
      expect(canEditLabel(row({ status: 'invalid', reason }))).toBe(true);
    },
  );

  it('refuses an invalid row whose problem a label cannot fix', () => {
    expect(canEditLabel(row({ status: 'invalid', reason: 'date_invalid' }))).toBe(false);
    expect(canEditLabel(row({ status: 'invalid', reason: null }))).toBe(false);
  });
});

describe('canReconcileRecorded', () => {
  it('is true for a skipped row whose operation is not reconciled', () => {
    expect(canReconcileRecorded(row({ status: 'skipped', recorded: recorded(false) }))).toBe(true);
  });

  it('is false once the operation is reconciled, without one, or for a row to import', () => {
    expect(canReconcileRecorded(row({ status: 'skipped', recorded: recorded(true) }))).toBe(false);
    expect(canReconcileRecorded(row({ status: 'skipped', recorded: null }))).toBe(false);
    expect(canReconcileRecorded(row({ status: 'import', recorded: recorded(false) }))).toBe(false);
  });
});

describe('projectBalances', () => {
  const current = { balance: 100, reconciledBalance: 60 };
  const none = { included: new Set<number>(), reconcileImported: true, reconcileLines: [] };
  const credit = (line: number, amount: number, status: PreviewRow['status'] = 'import') =>
    row({ line, status, type: 'credit', amount });
  const debit = (line: number, amount: number, status: PreviewRow['status'] = 'import') =>
    row({ line, status, type: 'debit', amount });

  it('keeps the figures of an account when no row is imported', () => {
    expect(projectBalances(current, [], none)).toEqual({
      balance: 1_000_000,
      reconciledBalance: 600_000,
    });
  });

  it('adds credits and takes debits of the rows to import, reconciled as the file is', () => {
    const rows = [credit(1, 50.25), debit(2, 10)];

    expect(projectBalances(current, rows, none)).toEqual({
      balance: 1_402_500,
      reconciledBalance: 1_002_500,
    });
    expect(projectBalances(current, rows, { ...none, reconcileImported: false })).toEqual({
      balance: 1_402_500,
      reconciledBalance: 600_000,
    });
  });

  it('ignores invalid rows and skipped rows nobody picked', () => {
    const rows = [row({ line: 1, status: 'invalid', amount: null }), credit(2, 20, 'skipped')];

    expect(projectBalances(current, rows, none)).toEqual({
      balance: 1_000_000,
      reconciledBalance: 600_000,
    });
  });

  it('imports a skipped row chosen anyway', () => {
    const rows = [debit(1, 5, 'skipped')];

    expect(projectBalances(current, rows, { ...none, included: new Set([1]) })).toEqual({
      balance: 950_000,
      reconciledBalance: 550_000,
    });
  });

  it('reconciles the recorded operations chosen, without moving the balance', () => {
    const rows = [credit(1, 20, 'skipped'), debit(2, 4, 'skipped')];

    expect(projectBalances(current, rows, { ...none, reconcileLines: [1, 2] })).toEqual({
      balance: 1_000_000,
      reconciledBalance: 760_000,
    });
  });
});

import type { PreviewRow } from './import.types';
import { canEditLabel, canReconcileRecorded } from './importRows';

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

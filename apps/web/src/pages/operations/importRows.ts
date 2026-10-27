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

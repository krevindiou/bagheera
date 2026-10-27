import type { EntryType } from '@bagheera/reference-data';

// Why a row cannot be imported; the web translates each.
export const INVALID_REASONS = [
  'cell_missing',
  'date_invalid',
  'date_out_of_range',
  'amount_invalid',
  'amount_zero',
  'amount_too_large',
  'third_party_missing',
  'third_party_too_long',
] as const;
export type InvalidReason = (typeof INVALID_REASONS)[number];

// Where a row's third party comes from: the file itself, a label correction
// the Member remembered, or a change the Member made in this preview.
export type LabelOrigin = 'file' | 'correction' | 'change';

// Where a row's category or transfer account comes from: the Member's earlier
// operations, or a pick made in this preview.
export type SuggestionOrigin = 'history' | 'picked';

// Where a row's payment method comes from. `default` is the standard method of
// its side, taken when nothing names one: history may still replace it.
export type MethodOrigin = SuggestionOrigin | 'default';

// The operation a skipped row matches.
export interface RecordedMatch {
  // Kept on the server: the Member never sends an operation id.
  operationId: string;
  valueDate: string;
  thirdParty: string;
  reconciled: boolean;
  // `transfer`: the other side of a transfer already recorded in the account.
  matchedBy: 'reference' | 'details' | 'transfer';
}

export interface ParsedRow {
  // 1-based position among the file's data rows.
  line: number;
  valueDate: string;
  type: EntryType;
  // Always positive, in minor units.
  amount: number;
  thirdParty: string;
  notes: string;
  paymentMethodId: string;
  paymentMethodOrigin: MethodOrigin | null;
  categoryId: string | null;
  categoryOrigin: SuggestionOrigin | null;
  // The other account of a transfer; null otherwise.
  transferAccountId: string | null;
  transferAccountOrigin: SuggestionOrigin | null;
  // The file's own label of the row, trimmed, kept to recognise the row in a
  // later import.
  sourceLabel: string;
  labelOrigin: LabelOrigin;
  // The identifier the bank gave the row, when it gave a usable one.
  bankReference: string | null;
  // Set on a skipped row.
  recorded: RecordedMatch | null;
}

// A row that can be imported, or that would be but for an operation already
// in the account.
export type ReadyRow = ParsedRow & { status: 'import' | 'skipped' };

export type RowOutcome =
  ReadyRow | { status: 'invalid'; line: number; reason: InvalidReason; sourceLabel: string | null };

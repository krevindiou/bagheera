import { createHash } from 'node:crypto';
import type { RecordedOperation } from './recorded-match';
import {
  bestByKey,
  type CategoryUse,
  type CountedUse,
  type MethodUse,
  type TransferUse,
} from './suggestions';
import type { RowOutcome } from './types';

// What an evaluation reads from the database besides the file, and what it
// made of the rows.
export interface Evidence {
  corrections: ReadonlyMap<string, string>;
  methods: MethodUse[];
  categories: CategoryUse[];
  transfers: TransferUse[];
  recorded: RecordedOperation[];
  rows: RowOutcome[];
}

// Where each row stands, and the operation a skipped one matches: a pick of
// the Member can move a row, which the database evidence alone does not show.
function placeOf(row: RowOutcome): [number, string, string | null] {
  return [
    row.line,
    row.status,
    row.status === 'skipped' ? (row.recorded?.operationId ?? null) : null,
  ];
}

const sorted = <T>(items: T[]) => items.map((item) => JSON.stringify(item)).sort();

// What the history suggests for each third party, not how often it was used:
// operations entered since the preview only matter when they change a
// suggestion.
function suggestions<T extends CountedUse>(usage: T[], choice: (use: T) => string): string[] {
  return sorted([...bestByKey(usage, choice)].map(([key, use]) => [key, choice(use)]));
}

// The part of the mark that rests on the account's own operations: those the
// rows can match, and where each row ends up. It is the part that can be
// checked again while the account is held, to catch an operation entered since
// the rows were worked out.
export function accountMarkOf(recorded: RecordedOperation[], rows: RowOutcome[]): string {
  return createHash('sha256')
    .update(JSON.stringify([sorted(recorded), rows.map(placeOf)]))
    .digest('hex');
}

// A mark of everything the rows are worked out from (the history through what
// it suggests) and of where they end up,
// so that a confirmation can tell whether the operations or corrections behind
// a preview changed, or a choice moved a row.
export function revisionOf(evidence: Evidence): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        [...evidence.corrections].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        suggestions(evidence.methods, (use) => use.paymentMethodId),
        suggestions(evidence.categories, (use) => use.categoryId),
        suggestions(evidence.transfers, (use) => use.accountId),
        sorted(evidence.recorded),
        evidence.rows.map(placeOf),
      ]),
    )
    .digest('hex');
}

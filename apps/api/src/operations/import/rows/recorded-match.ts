import { TRANSFER_PAYMENT_METHOD_IDS, type EntryType } from '@bagheera/reference-data';
import { normalizeLabel } from './labels';
import type { RecordedMatch, RowOutcome } from './types';

export interface RecordedOperation {
  id: string;
  reconciled: boolean;
  paymentMethodId: string;
  valueDate: string;
  debit: number | null;
  credit: number | null;
  thirdParty: string;
  // The label of the file the operation was imported from; null when typed.
  sourceLabel: string | null;
  // The identifier the bank gave the row it was imported from; null otherwise.
  bankReference: string | null;
}

// How many days apart the two banks may post the two sides of a transfer.
export const TRANSFER_DATE_TOLERANCE_DAYS = 3;

// How many days apart a row and an operation of the same amount and label may
// be: the Member enters the day of the purchase, the bank posts it a day or two
// later. Within the transfer tolerance, so the same operations are read.
export const DETAILS_DATE_TOLERANCE_DAYS = 2;

// How many days apart a row and the operation carrying its bank reference may
// be: a bank that reuses its references does so far apart, while the Member
// may have moved the date of an operation by a few days.
export const REFERENCE_DATE_TOLERANCE_DAYS = 31;

interface Candidate {
  thirdParty: string;
  source: string | null;
  type: EntryType;
  amount: number;
  date: number;
  used: boolean;
  // Typed by the Member and not reconciled: only such an operation is matched
  // on a nearby date, since one a bank row was already matched to is more
  // likely another purchase than a late posting.
  typed: boolean;
  // Set for an operation that could be the other side of a transfer: one of
  // the transfer payment methods that no bank file has described yet.
  otherSide: { type: EntryType; amount: number; date: number } | null;
  recorded: Omit<RecordedMatch, 'matchedBy'>;
}

// A calendar day as a number of days, to count days between two dates.
export function dayNumber(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

export function shiftDays(date: string, days: number): string {
  return new Date((dayNumber(date) + days) * 86_400_000).toISOString().slice(0, 10);
}

// The stretches of days within the tolerance of a date of the rows, joined
// where they touch: the only days whose operations a row can match.
export function recordedWindows(dates: string[]): { from: string; to: string }[] {
  const windows: { from: string; to: string }[] = [];
  for (const date of [...new Set(dates)].sort()) {
    const from = shiftDays(date, -TRANSFER_DATE_TOLERANCE_DAYS);
    const to = shiftDays(date, TRANSFER_DATE_TOLERANCE_DAYS);
    const last = windows[windows.length - 1];
    if (last && from <= shiftDays(last.to, 1)) last.to = to;
    else windows.push({ from, to });
  }
  return windows;
}

function groupKey(valueDate: string, type: EntryType, amount: number): string {
  return `${valueDate}|${type}|${amount}`;
}

// Marks as skipped each row that an operation already in the account matches,
// in two passes over the whole file so that a row matched by
// its bank reference is never robbed of its operation by another row: first
// the bank references with the same side, amount and period, then, for the rows left, the same value date, side and
// amount with either the same third party or the same label of the file, then
// the same without the date, for the operations the Member typed. Each
// operation matches at most one row, so n equal rows against m equal
// operations skip min(n, m) of them.
export function markRecorded(rows: RowOutcome[], recorded: RecordedOperation[]): RowOutcome[] {
  const groups = new Map<string, Candidate[]>();
  const byReference = new Map<string, Candidate[]>();
  const typedByAmount = new Map<string, Candidate[]>();
  for (const operation of recorded) {
    const type: EntryType = operation.debit === null ? 'credit' : 'debit';
    const amount = (operation.debit ?? operation.credit) as number;
    const date = dayNumber(operation.valueDate);
    const candidate: Candidate = {
      thirdParty: normalizeLabel(operation.thirdParty),
      source: operation.sourceLabel === null ? null : normalizeLabel(operation.sourceLabel),
      type,
      amount,
      date,
      used: false,
      typed: !operation.reconciled && operation.bankReference === null,
      otherSide:
        TRANSFER_PAYMENT_METHOD_IDS.includes(operation.paymentMethodId) &&
        operation.bankReference === null &&
        operation.sourceLabel === null
          ? { type, amount, date }
          : null,
      recorded: {
        operationId: operation.id,
        valueDate: operation.valueDate,
        thirdParty: operation.thirdParty,
        reconciled: operation.reconciled,
      },
    };
    const key = groupKey(operation.valueDate, type, amount);
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
    if (candidate.typed) {
      const sameAmount = `${type}|${amount}`;
      typedByAmount.set(sameAmount, [...(typedByAmount.get(sameAmount) ?? []), candidate]);
    }
    if (operation.bankReference !== null) {
      byReference.set(operation.bankReference, [
        ...(byReference.get(operation.bankReference) ?? []),
        candidate,
      ]);
    }
  }

  const skipped = new Map<number, RecordedMatch>();
  const take = (
    candidate: Candidate | undefined,
    line: number,
    matchedBy: RecordedMatch['matchedBy'],
  ) => {
    if (!candidate) return;
    candidate.used = true;
    skipped.set(line, { ...candidate.recorded, matchedBy });
  };

  for (const row of rows) {
    if (row.status !== 'import' || row.bankReference === null) continue;
    // A bank may reuse a reference for unrelated rows: the side, the amount and
    // the period must agree too.
    const date = dayNumber(row.valueDate);
    take(
      byReference
        .get(row.bankReference)
        ?.find(
          (candidate) =>
            !candidate.used &&
            candidate.type === row.type &&
            candidate.amount === row.amount &&
            Math.abs(candidate.date - date) <= REFERENCE_DATE_TOLERANCE_DAYS,
        ),
      row.line,
      'reference',
    );
  }
  for (const row of rows) {
    if (row.status !== 'import' || skipped.has(row.line)) continue;
    const group = groups.get(groupKey(row.valueDate, row.type, row.amount));
    if (!group) continue;
    const thirdParty = normalizeLabel(row.thirdParty);
    const source = normalizeLabel(row.sourceLabel);
    take(
      group.find((candidate) => !candidate.used && candidate.thirdParty === thirdParty) ??
        group.find((candidate) => !candidate.used && source !== '' && candidate.source === source),
      row.line,
      'details',
    );
  }
  // Then, for the rows left, the same amount and label a few days apart, the
  // closest first: the exact dates above have taken theirs already.
  for (const row of rows) {
    if (row.status !== 'import' || skipped.has(row.line)) continue;
    const date = dayNumber(row.valueDate);
    const thirdParty = normalizeLabel(row.thirdParty);
    const source = normalizeLabel(row.sourceLabel);
    let closest: { candidate: Candidate; gap: number } | undefined;
    for (const candidate of typedByAmount.get(`${row.type}|${row.amount}`) ?? []) {
      const gap = Math.abs(candidate.date - date);
      const sameLabel =
        candidate.thirdParty === thirdParty || (source !== '' && candidate.source === source);
      if (candidate.used || !sameLabel || gap > DETAILS_DATE_TOLERANCE_DAYS) continue;
      if (!closest || gap < closest.gap) closest = { candidate, gap };
    }
    take(closest?.candidate, row.line, 'details');
  }
  // A transfer row not matched yet may be the other side of a transfer the
  // account holds already, whatever the third party and within a few days.
  const otherSides = new Map<string, Candidate[]>();
  for (const candidate of [...groups.values()].flat()) {
    if (!candidate.otherSide) continue;
    const key = `${candidate.otherSide.type}|${candidate.otherSide.amount}`;
    otherSides.set(key, [...(otherSides.get(key) ?? []), candidate]);
  }
  for (const row of rows) {
    if (
      row.status !== 'import' ||
      skipped.has(row.line) ||
      !TRANSFER_PAYMENT_METHOD_IDS.includes(row.paymentMethodId)
    ) {
      continue;
    }
    const date = dayNumber(row.valueDate);
    let best: { candidate: Candidate; gap: number } | undefined;
    for (const candidate of otherSides.get(`${row.type}|${row.amount}`) ?? []) {
      const side = candidate.otherSide;
      if (candidate.used || !side) continue;
      const gap = Math.abs(side.date - date);
      if (gap <= TRANSFER_DATE_TOLERANCE_DAYS && (!best || gap < best.gap)) {
        best = { candidate, gap };
      }
    }
    take(best?.candidate, row.line, 'transfer');
  }

  return rows.map((row): RowOutcome => {
    const recorded = skipped.get(row.line);
    return row.status === 'import' && recorded ? { ...row, status: 'skipped', recorded } : row;
  });
}

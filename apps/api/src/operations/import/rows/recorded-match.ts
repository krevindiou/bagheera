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
  // Its place among the operations read: the first one wins a tie.
  order: number;
  used: boolean;
  // Typed by the Member and not reconciled: only such an operation is matched
  // on a nearby date, since one a bank row was already matched to is more
  // likely another purchase than a late posting.
  typed: boolean;
  // Set for an operation that could be the other side of a transfer: one of
  // the transfer payment methods that no bank file has described yet.
  otherSide: boolean;
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

// The same side and amount on a calendar day; a label or a reference, of any
// text, goes after it.
function dayKey(type: EntryType, amount: number, date: number): string {
  return `${type}|${amount}|${date}`;
}

function add<V>(map: Map<string, V[]>, key: string, item: V): void {
  const list = map.get(key);
  if (list) list.push(item);
  else map.set(key, [item]);
}

// The first candidate of a list not taken yet. A taken candidate stays taken,
// so each list's cursor only moves forward. It is kept by list, not by key:
// two indexes may hold different lists under the same key.
class Untaken {
  private readonly cursors = new Map<Candidate[], number>();

  first(list: Candidate[] | undefined): Candidate | undefined {
    if (!list) return undefined;
    let at = this.cursors.get(list) ?? 0;
    while (at < list.length && list[at].used) at += 1;
    this.cursors.set(list, at);
    return list[at];
  }

  // The first one, by rank, among the lists' first candidates not taken.
  earliest(
    lists: (Candidate[] | undefined)[],
    rank: (candidate: Candidate) => number,
  ): Candidate | undefined {
    let best: Candidate | undefined;
    for (const list of lists) {
      const candidate = this.first(list);
      if (candidate && (!best || rank(candidate) < rank(best))) best = candidate;
    }
    return best;
  }
}

// The days a gap away from a date, the closest first.
function daysAround(date: number, gap: number): number[] {
  return gap === 0 ? [date] : [date - gap, date + gap];
}

// Marks as skipped each row that an operation already in the account matches,
// in two passes over the whole file so that a row matched by
// its bank reference is never robbed of its operation by another row: first
// the bank references with the same side, amount and period, then, for the rows left, the same value date, side and
// amount with either the same third party or the same label of the file, then
// the same without the date, for the operations the Member typed. Each
// operation matches at most one row, so n equal rows against m equal
// operations skip min(n, m) of them.
// Every lookup goes through an index of the candidates, so that an account
// holding many operations alike is read once, not once per row.
export function markRecorded(rows: RowOutcome[], recorded: RecordedOperation[]): RowOutcome[] {
  const groups = new Map<string, Candidate[]>();
  const byThirdParty = new Map<string, Candidate[]>();
  const bySource = new Map<string, Candidate[]>();
  const typedByThirdParty = new Map<string, Candidate[]>();
  const typedBySource = new Map<string, Candidate[]>();
  const byReference = new Map<string, Candidate[]>();
  recorded.forEach((operation, order) => {
    const type: EntryType = operation.debit === null ? 'credit' : 'debit';
    const amount = (operation.debit ?? operation.credit) as number;
    const date = dayNumber(operation.valueDate);
    const candidate: Candidate = {
      thirdParty: normalizeLabel(operation.thirdParty),
      source: operation.sourceLabel === null ? null : normalizeLabel(operation.sourceLabel),
      type,
      amount,
      date,
      order,
      used: false,
      typed: !operation.reconciled && operation.bankReference === null,
      otherSide:
        TRANSFER_PAYMENT_METHOD_IDS.includes(operation.paymentMethodId) &&
        operation.bankReference === null &&
        operation.sourceLabel === null,
      recorded: {
        operationId: operation.id,
        valueDate: operation.valueDate,
        thirdParty: operation.thirdParty,
        reconciled: operation.reconciled,
      },
    };
    const key = groupKey(operation.valueDate, type, amount);
    add(groups, key, candidate);
    add(byThirdParty, `${key}|${candidate.thirdParty}`, candidate);
    if (candidate.source !== null) add(bySource, `${key}|${candidate.source}`, candidate);
    const day = dayKey(type, amount, date);
    if (candidate.typed) {
      add(typedByThirdParty, `${day}|${candidate.thirdParty}`, candidate);
      if (candidate.source !== null) add(typedBySource, `${day}|${candidate.source}`, candidate);
    }
    if (operation.bankReference !== null) {
      add(byReference, `${day}|${operation.bankReference}`, candidate);
    }
  });

  const untaken = new Untaken();
  const byOrder = (candidate: Candidate) => candidate.order;
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
    const lists: (Candidate[] | undefined)[] = [];
    for (
      let day = date - REFERENCE_DATE_TOLERANCE_DAYS;
      day <= date + REFERENCE_DATE_TOLERANCE_DAYS;
      day += 1
    ) {
      lists.push(byReference.get(`${dayKey(row.type, row.amount, day)}|${row.bankReference}`));
    }
    take(untaken.earliest(lists, byOrder), row.line, 'reference');
  }
  for (const row of rows) {
    if (row.status !== 'import' || skipped.has(row.line)) continue;
    const key = groupKey(row.valueDate, row.type, row.amount);
    const thirdParty = normalizeLabel(row.thirdParty);
    const source = normalizeLabel(row.sourceLabel);
    take(
      untaken.first(byThirdParty.get(`${key}|${thirdParty}`)) ??
        (source === '' ? undefined : untaken.first(bySource.get(`${key}|${source}`))),
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
    let closest: Candidate | undefined;
    for (let gap = 0; gap <= DETAILS_DATE_TOLERANCE_DAYS && !closest; gap += 1) {
      const lists = daysAround(date, gap).flatMap((day) => {
        const key = dayKey(row.type, row.amount, day);
        return [
          typedByThirdParty.get(`${key}|${thirdParty}`),
          source === '' ? undefined : typedBySource.get(`${key}|${source}`),
        ];
      });
      closest = untaken.earliest(lists, byOrder);
    }
    take(closest, row.line, 'details');
  }
  // A transfer row not matched yet may be the other side of a transfer the
  // account holds already, whatever the third party and within a few days.
  // Among those as close, the first one of the groups above wins.
  const otherSides = new Map<string, Candidate[]>();
  const sideRank = new Map<Candidate, number>();
  for (const group of groups.values()) {
    for (const candidate of group) {
      if (!candidate.otherSide) continue;
      sideRank.set(candidate, sideRank.size);
      add(otherSides, dayKey(candidate.type, candidate.amount, candidate.date), candidate);
    }
  }
  const bySideRank = (candidate: Candidate) => sideRank.get(candidate) as number;
  for (const row of rows) {
    if (
      row.status !== 'import' ||
      skipped.has(row.line) ||
      !TRANSFER_PAYMENT_METHOD_IDS.includes(row.paymentMethodId)
    ) {
      continue;
    }
    const date = dayNumber(row.valueDate);
    let best: Candidate | undefined;
    for (let gap = 0; gap <= TRANSFER_DATE_TOLERANCE_DAYS && !best; gap += 1) {
      const lists = daysAround(date, gap).map((day) =>
        otherSides.get(dayKey(row.type, row.amount, day)),
      );
      best = untaken.earliest(lists, bySideRank);
    }
    take(best, row.line, 'transfer');
  }

  return rows.map((row): RowOutcome => {
    const recorded = skipped.get(row.line);
    return row.status === 'import' && recorded ? { ...row, status: 'skipped', recorded } : row;
  });
}

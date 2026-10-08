// Pure date arithmetic for occurrence generation, on plain 'YYYY-MM-DD'
// strings (never a JS `Date`, so no timezone drift).

export type FrequencyUnit = 'day' | 'week' | 'month' | 'year';

interface YearMonthDay {
  year: number;
  month: number; // 1-12
  day: number;
}

function parseIsoDate(iso: string): YearMonthDay {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

function formatIsoDate({ year, month, day }: YearMonthDay): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the following month is the last day of `month`.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// UTC `Date` arithmetic is safe for days: no clamping involved.
function addDays(date: YearMonthDay, days: number): YearMonthDay {
  const asDate = new Date(Date.UTC(date.year, date.month - 1, date.day));
  asDate.setUTCDate(asDate.getUTCDate() + days);
  return {
    year: asDate.getUTCFullYear(),
    month: asDate.getUTCMonth() + 1,
    day: asDate.getUTCDate(),
  };
}

// A missing anchor day clamps to the month's last day for that occurrence
// only, since each is computed from the anchor (Jan 31 → Feb 28 → Mar 31).
function addMonthsClamped(date: YearMonthDay, months: number): YearMonthDay {
  const totalMonths = date.month - 1 + months;
  const year = date.year + Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12; // 0-11
  const lastDayOfTargetMonth = daysInMonth(year, month + 1);
  const day = Math.min(date.day, lastDayOfTargetMonth);
  return { year, month: month + 1, day };
}

// Occurrence n (0-indexed) of a scheduler anchored at `valueDate`: the
// value date plus n × the interval.
export function occurrenceDate(
  valueDate: string,
  unit: FrequencyUnit,
  value: number,
  n: number,
): string {
  const anchor = parseIsoDate(valueDate);
  switch (unit) {
    case 'day':
      return formatIsoDate(addDays(anchor, value * n));
    case 'week':
      return formatIsoDate(addDays(anchor, value * n * 7));
    case 'month':
      return formatIsoDate(addMonthsClamped(anchor, value * n));
    case 'year':
      return formatIsoDate(addMonthsClamped(anchor, value * n * 12));
  }
}

export interface DueOccurrencesParams {
  valueDate: string;
  frequencyUnit: FrequencyUnit;
  frequencyValue: number;
  // Exclusive lower bound — the latest already-generated occurrence date,
  // or null when nothing has been generated yet (occurrence 0 is due).
  after: string | null;
  // Inclusive upper bound — today, or the limit date if earlier.
  horizon: string;
  // At most this many, never more than MAX_OCCURRENCES_PER_RUN — for a
  // caller sharing one budget across several schedulers.
  limit?: number;
}

// Ceiling per call: daily since 1990 would otherwise be an unbounded run of
// inserts. The rest isn't lost: the next run resumes from the cursor.
export const MAX_OCCURRENCES_PER_RUN = 1000;

// Occurrences in (`after`, `horizon`], chronological, at most `limit`.
export function dueOccurrences(params: DueOccurrencesParams): string[] {
  const { valueDate, frequencyUnit, frequencyValue, after, horizon } = params;
  const limit = Math.min(params.limit ?? MAX_OCCURRENCES_PER_RUN, MAX_OCCURRENCES_PER_RUN);
  const dates: string[] = [];
  if (limit <= 0) {
    return dates;
  }
  for (let n = 0; ; n++) {
    const date = occurrenceDate(valueDate, frequencyUnit, frequencyValue, n);
    if (date > horizon) {
      break;
    }
    if (after === null || date > after) {
      dates.push(date);
      if (dates.length >= limit) {
        break;
      }
    }
  }
  return dates;
}

// Pure date arithmetic for scheduler occurrence generation. Deliberately
// free of any DB dependency so it's unit- and property-testable in
// isolation. Dates are plain 'YYYY-MM-DD' strings throughout (as stored by
// Drizzle's `date` column mode) — never a JS `Date`, to sidestep timezone
// drift entirely.

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

// Adds a whole number of days to an ISO date via `Date`'s own UTC
// arithmetic (safe here — no month/year clamping is involved).
function addDays(date: YearMonthDay, days: number): YearMonthDay {
  const asDate = new Date(Date.UTC(date.year, date.month - 1, date.day));
  asDate.setUTCDate(asDate.getUTCDate() + days);
  return {
    year: asDate.getUTCFullYear(),
    month: asDate.getUTCMonth() + 1,
    day: asDate.getUTCDate(),
  };
}

// Adds a whole number of months to an ISO date. When the anchor day
// doesn't exist in the target month (e.g. Jan 31 + 1 month), only that
// occurrence clamps to the target month's last day — the anchor day itself
// is unaffected, so a later occurrence that lands on a longer month
// returns to the original day (Jan 31 → Feb 28 → Mar 31).
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
}

// Every occurrence strictly after `after` (or from occurrence 0 if `after`
// is null) up to and including `horizon`, in chronological order. ISO date
// strings compare correctly with plain `<`/`>` since they're zero-padded.
export function dueOccurrences(params: DueOccurrencesParams): string[] {
  const { valueDate, frequencyUnit, frequencyValue, after, horizon } = params;
  const dates: string[] = [];
  for (let n = 0; ; n++) {
    const date = occurrenceDate(valueDate, frequencyUnit, frequencyValue, n);
    if (date > horizon) {
      break;
    }
    if (after === null || date > after) {
      dates.push(date);
    }
  }
  return dates;
}

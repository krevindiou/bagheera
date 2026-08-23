// Pure period-grouping arithmetic for report chart aggregation. Dates are
// plain 'YYYY-MM-DD' strings throughout (as stored by Drizzle's `date`
// column mode) — never a JS `Date`, to sidestep timezone drift entirely.
// "All" grouping (a single aggregate point) is handled by the caller and
// has no period arithmetic of its own.

export type PeriodGrouping = 'month' | 'quarter' | 'year';

function parseIsoDate(iso: string): { year: number; month: number } {
  const [year, month] = iso.split('-').map(Number);
  return { year, month };
}

function formatPeriodStart(year: number, month: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  return `${y}-${m}-01`;
}

// Floors a date down to the first day of its containing period.
export function periodStart(date: string, grouping: PeriodGrouping): string {
  const { year, month } = parseIsoDate(date);
  if (grouping === 'year') {
    return formatPeriodStart(year, 1);
  }
  if (grouping === 'quarter') {
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
    return formatPeriodStart(year, quarterStartMonth);
  }
  return formatPeriodStart(year, month);
}

// The next period's start date, one step after `key` (itself a period
// start returned by `periodStart`).
export function nextPeriodStart(key: string, grouping: PeriodGrouping): string {
  return addMonths(
    key,
    grouping === 'year' ? 12 : grouping === 'quarter' ? 3 : 1,
  );
}

// `key` (a month-period start, 'YYYY-MM-01') shifted by `months` steps —
// negative to go backward. Used to derive the start of a trailing N-month
// window (e.g. the dashboard/account synthesis chart's last-12-months
// window), and shared by `nextPeriodStart` for its single-step case.
export function addMonths(key: string, months: number): string {
  const { year, month } = parseIsoDate(key);
  const totalMonths = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (((totalMonths % 12) + 12) % 12) + 1;
  return formatPeriodStart(nextYear, nextMonth);
}

// Every period-start key from `first` to `last` inclusive — zero-fills the
// gaps between the populated periods present in a series.
export function fillPeriodGaps(
  first: string,
  last: string,
  grouping: PeriodGrouping,
): string[] {
  const keys: string[] = [];
  for (let key = first; key <= last; key = nextPeriodStart(key, grouping)) {
    keys.push(key);
  }
  return keys;
}

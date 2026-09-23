// Pure period-grouping arithmetic for report chart aggregation. Dates are
// plain 'YYYY-MM-DD' strings throughout (as stored by Drizzle's `date`
// column mode) — never a JS `Date`, to sidestep timezone drift entirely.
// "All" grouping (a single aggregate point) is handled by the caller and
// has no period arithmetic of its own.

import { MAX_VALUE_DATE, MIN_VALUE_DATE } from '../../common/value-date';

export type PeriodGrouping = 'month' | 'quarter' | 'year';

const STEP_MONTHS: Record<PeriodGrouping, number> = { month: 1, quarter: 3, year: 12 };

function parseIsoDate(iso: string): { year: number; month: number } {
  const [year, month] = iso.split('-').map(Number);
  return { year, month };
}

function formatPeriodStart(year: number, month: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  return `${y}-${m}-01`;
}

// A date's month as one integer (months since year 0), so stepping and
// bounds checks are plain arithmetic rather than string comparisons — see
// fillPeriodGaps for why the strings themselves can't be trusted to order.
function monthIndex(date: string): number {
  const { year, month } = parseIsoDate(date);
  return year * 12 + (month - 1);
}

function periodStartFromMonthIndex(index: number): string {
  return formatPeriodStart(Math.floor(index / 12), (((index % 12) + 12) % 12) + 1);
}

// Hard ceiling on how many keys fillPeriodGaps returns: the widest month
// range any accepted date can span (common/value-date.ts's bounds, 201
// years), so it never truncates data entered through today's validation —
// it only bounds rows stored before dates were range-checked, which could
// otherwise inflate a single chart into millions of points.
export const MAX_PERIODS = monthIndex(MAX_VALUE_DATE) - monthIndex(MIN_VALUE_DATE) + 1;

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
  return addMonths(key, STEP_MONTHS[grouping]);
}

// `key` (a month-period start, 'YYYY-MM-01') shifted by `months` steps —
// negative to go backward. Used to derive the start of a trailing N-month
// window (e.g. the dashboard/account synthesis chart's last-12-months
// window), and shared by `nextPeriodStart` for its single-step case.
export function addMonths(key: string, months: number): string {
  return periodStartFromMonthIndex(monthIndex(key) + months);
}

// Every period-start key from `first` to `last` inclusive — zero-fills the
// gaps between the populated periods present in a series. Walks integer
// month indices instead of comparing the keys: past year 9999 the next key
// ('10000-01-01') sorts *before* '9999-12-01' as a string, so a string bound
// never ends the walk. Capped at the MAX_PERIODS most recent keys (the
// latest periods are the ones a chart is read for), still stepping from
// `first` so the keys stay on its period grid.
export function fillPeriodGaps(first: string, last: string, grouping: PeriodGrouping): string[] {
  const step = STEP_MONTHS[grouping];
  const firstIndex = monthIndex(first);
  const lastIndex = monthIndex(last);
  const total = Math.floor((lastIndex - firstIndex) / step) + 1;
  const skipped = Math.max(0, total - MAX_PERIODS);
  const keys: string[] = [];
  for (let index = firstIndex + skipped * step; index <= lastIndex; index += step) {
    keys.push(periodStartFromMonthIndex(index));
  }
  return keys;
}

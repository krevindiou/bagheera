// Period arithmetic for chart aggregation, on plain 'YYYY-MM-DD' strings
// (never a JS `Date`, so no timezone drift). 'all' grouping is the
// caller's.

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

// Months since year 0, so stepping and bounds are plain arithmetic (see
// fillPeriodGaps for why strings can't be trusted to order).
function monthIndex(date: string): number {
  const { year, month } = parseIsoDate(date);
  return year * 12 + (month - 1);
}

function periodStartFromMonthIndex(index: number): string {
  return formatPeriodStart(Math.floor(index / 12), (((index % 12) + 12) % 12) + 1);
}

// Ceiling on fillPeriodGaps' keys: the widest range value-date.ts accepts,
// so it only ever truncates rows stored before dates were range-checked.
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

// The period start one step after `key` (a period start).
export function nextPeriodStart(key: string, grouping: PeriodGrouping): string {
  return addMonths(key, STEP_MONTHS[grouping]);
}

// `key` ('YYYY-MM-01') shifted by `months`, negative to go backward.
export function addMonths(key: string, months: number): string {
  return periodStartFromMonthIndex(monthIndex(key) + months);
}

// Every period-start key from `first` to `last` inclusive, to zero-fill a
// series' gaps. Walks month indices: past year 9999, '10000-01-01' sorts
// before '9999-12-01' as a string. Keeps the MAX_PERIODS most recent keys,
// still on `first`'s period grid.
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

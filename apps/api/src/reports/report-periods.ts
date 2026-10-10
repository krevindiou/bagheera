import { sql } from 'drizzle-orm';
import { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { PeriodGrouping } from '@bagheera/reference-data';
import { localIsoDate } from '../common/local-date';

// Map key for the 'all' bucket (a SQL NULL period).
export const ALL_PERIOD_KEY = 'all';

// `date_trunc` field per grouping; 'all' is one bucket with no period.
const DATE_TRUNC_FIELD = {
  month: 'month',
  quarter: 'quarter',
  year: 'year',
} as const;

/** The period-bucketing expression for a date column; constant `null` for 'all'. */
export function periodExpr(column: AnyPgColumn, grouping: PeriodGrouping) {
  return grouping === 'all'
    ? sql<string | null>`null`
    : sql<string | null>`date_trunc(${DATE_TRUNC_FIELD[grouping]}, ${column})::date`;
}

// Label for the 'all' bucket: just *a* date for the time axis, not a
// claim the data is from this year.
export function currentYearStart(): string {
  return `${localIsoDate().slice(0, 4)}-01-01`;
}

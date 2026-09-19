import { sql } from 'drizzle-orm';
import { AnyPgColumn } from 'drizzle-orm/pg-core';

export type PeriodGrouping = 'month' | 'quarter' | 'year' | 'all';

// The sentinel key a 'all'-grouped period column value (SQL NULL) maps to
// in JS-side Maps — shared by every report aggregation that buckets by
// period (report-series.service.ts, report-distribution.service.ts).
export const ALL_PERIOD_KEY = 'all';

// Postgres `date_trunc(field, ...)` field names, one per non-'all' grouping.
// 'all' has no period arithmetic — it is a single aggregate bucket handled
// separately below, without a GROUP BY on period at all.
const DATE_TRUNC_FIELD = {
  month: 'month',
  quarter: 'quarter',
  year: 'year',
} as const;

/**
 * The period-bucketing SQL expression for a date column, or a constant
 * `null` for 'all' — shared by every report aggregation that groups by
 * period, so the GROUP BY ordinal-position workaround (see call sites)
 * and the date_trunc field mapping live in exactly one place.
 */
export function periodExpr(column: AnyPgColumn, grouping: PeriodGrouping) {
  return grouping === 'all'
    ? sql<string | null>`null`
    : sql<string | null>`date_trunc(${DATE_TRUNC_FIELD[grouping]}, ${column})::date`;
}

// The single 'all'-grouped bucket is labeled with the current calendar
// year's start date (rather than, say, the report's own date range) purely
// so it renders as *a* date on a time axis — it isn't meant to be read as
// "this data is from this year".
export function currentYearStart(): string {
  return `${new Date().getUTCFullYear()}-01-01`;
}

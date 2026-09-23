// The one rule for every date a member submits — an operation/scheduler
// value date, a scheduler limit date, a report's date range, a search's
// date filter. Plain 'YYYY-MM-DD' only (what Drizzle's `date` columns and
// every `<input type="date">` on the web side already exchange), a real
// calendar day, inside a bounded range.
//
// The bounds aren't about realism so much as about keeping every date the
// API stores inside what the chart code can walk safely: period keys are
// compared and stepped as 'YYYY-MM-DD' strings, and an unbounded year let a
// single operation dated 9999-12-31 turn one dashboard load into a
// million-point chart (see reports/chart/period.ts's MAX_PERIODS, which is
// sized from these same bounds).
export const MIN_VALUE_DATE = '1900-01-01';
export const MAX_VALUE_DATE = '2100-12-31';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValueDate(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const match = ISO_DATE.exec(value);
  // Zero-padded 'YYYY-MM-DD' strings order chronologically, so once the
  // shape is confirmed the range check is a plain string comparison.
  if (!match || value < MIN_VALUE_DATE || value > MAX_VALUE_DATE) {
    return false;
  }
  const [year, month, day] = match.slice(1).map(Number);
  // Day 0 of the following month is the last day of `month` — rejects
  // e.g. 2024-02-30 or 2023-02-29, which Postgres would otherwise refuse
  // with a 500 instead of this 400.
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= lastDayOfMonth;
}

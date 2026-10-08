// The rule for every date a member submits: plain 'YYYY-MM-DD', a real
// calendar day, inside these bounds. The bounds keep chart period walks
// small (reports/chart/period.ts's MAX_PERIODS is sized from them): one
// operation dated 9999-12-31 would otherwise make a million-point chart.
export const MIN_VALUE_DATE = '1900-01-01';
export const MAX_VALUE_DATE = '2100-12-31';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValueDate(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const match = ISO_DATE.exec(value);
  // Zero-padded dates order chronologically as strings.
  if (!match || value < MIN_VALUE_DATE || value > MAX_VALUE_DATE) {
    return false;
  }
  const [year, month, day] = match.slice(1).map(Number);
  // Day 0 of the next month is the last day of `month`; rejects e.g.
  // 2024-02-30, which Postgres would refuse with a 500.
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= lastDayOfMonth;
}

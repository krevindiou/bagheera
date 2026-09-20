import { AnyPgColumn } from 'drizzle-orm/pg-core';
import { currentYearStart, periodExpr } from './report-periods';

describe('periodExpr', () => {
  it("emits a plain SQL null for the 'all' grouping, without touching the column", () => {
    const expr = periodExpr({} as AnyPgColumn, 'all');
    expect(JSON.stringify(expr.queryChunks)).toContain('null');
  });

  it("emits a date_trunc expression for a real grouping (e.g. 'month')", () => {
    const expr = periodExpr({} as AnyPgColumn, 'month');
    expect(JSON.stringify(expr.queryChunks)).toContain('date_trunc');
  });
});

describe('currentYearStart', () => {
  it('returns January 1st of the current UTC year', () => {
    expect(currentYearStart()).toBe(`${new Date().getUTCFullYear()}-01-01`);
  });
});

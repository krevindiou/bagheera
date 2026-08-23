import {
  addMonths,
  fillPeriodGaps,
  nextPeriodStart,
  periodStart,
} from './period';

describe('periodStart', () => {
  it('floors a date to the first of its month', () => {
    expect(periodStart('2026-03-17', 'month')).toBe('2026-03-01');
  });

  it('floors a date to the first month of its quarter', () => {
    expect(periodStart('2026-05-01', 'quarter')).toBe('2026-04-01');
    expect(periodStart('2026-01-31', 'quarter')).toBe('2026-01-01');
    expect(periodStart('2026-12-25', 'quarter')).toBe('2026-10-01');
  });

  it('floors a date to the first of its year', () => {
    expect(periodStart('2026-07-04', 'year')).toBe('2026-01-01');
  });
});

describe('nextPeriodStart', () => {
  it('steps one month forward, rolling over the year', () => {
    expect(nextPeriodStart('2026-01-01', 'month')).toBe('2026-02-01');
    expect(nextPeriodStart('2026-12-01', 'month')).toBe('2027-01-01');
  });

  it('steps one quarter forward', () => {
    expect(nextPeriodStart('2026-10-01', 'quarter')).toBe('2027-01-01');
  });

  it('steps one year forward', () => {
    expect(nextPeriodStart('2026-01-01', 'year')).toBe('2027-01-01');
  });
});

describe('addMonths', () => {
  it('steps forward within a year', () => {
    expect(addMonths('2026-03-01', 2)).toBe('2026-05-01');
  });

  it('steps forward across a year boundary', () => {
    expect(addMonths('2026-11-01', 3)).toBe('2027-02-01');
  });

  it('steps backward within a year', () => {
    expect(addMonths('2026-08-01', -3)).toBe('2026-05-01');
  });

  it('steps backward across a year boundary', () => {
    expect(addMonths('2026-02-01', -3)).toBe('2025-11-01');
  });

  it('is a no-op for zero months', () => {
    expect(addMonths('2026-06-01', 0)).toBe('2026-06-01');
  });
});

describe('fillPeriodGaps', () => {
  it('produces every month between first and last inclusive', () => {
    expect(fillPeriodGaps('2026-01-01', '2026-04-01', 'month')).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
    ]);
  });

  it('returns a single key when first equals last', () => {
    expect(fillPeriodGaps('2026-01-01', '2026-01-01', 'year')).toEqual([
      '2026-01-01',
    ]);
  });
});

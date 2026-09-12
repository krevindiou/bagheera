import { addMonths, fillPeriodGaps, nextPeriodStart, periodStart } from './period';

describe('periodStart', () => {
  it('floors a date to the first of its month', () => {
    expect(periodStart('2026-03-17', 'month')).toBe('2026-03-01');
  });

  it.each([
    ['2026-01-15', '2026-01-01'],
    ['2026-02-15', '2026-01-01'],
    ['2026-03-15', '2026-01-01'],
    ['2026-04-15', '2026-04-01'],
    ['2026-07-15', '2026-07-01'],
    ['2026-10-15', '2026-10-01'],
    ['2026-12-15', '2026-10-01'],
  ])('floors %s to its quarter start %s', (date, expected) => {
    expect(periodStart(date, 'quarter')).toBe(expected);
  });

  it('floors a date to January 1st of its year', () => {
    expect(periodStart('2026-11-30', 'year')).toBe('2026-01-01');
  });
});

describe('nextPeriodStart', () => {
  it('advances one month, rolling over into the next year', () => {
    expect(nextPeriodStart('2025-12-01', 'month')).toBe('2026-01-01');
  });

  it('advances one quarter, rolling over into the next year', () => {
    expect(nextPeriodStart('2025-10-01', 'quarter')).toBe('2026-01-01');
  });

  it('advances one year', () => {
    expect(nextPeriodStart('2025-01-01', 'year')).toBe('2026-01-01');
  });
});

describe('addMonths', () => {
  it('shifts forward across a year boundary', () => {
    expect(addMonths('2025-11-01', 3)).toBe('2026-02-01');
  });

  it('shifts backward across a year boundary', () => {
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01');
  });

  it('is a no-op for a zero shift', () => {
    expect(addMonths('2026-06-01', 0)).toBe('2026-06-01');
  });

  it('shifts backward by more than a year', () => {
    expect(addMonths('2026-03-01', -14)).toBe('2025-01-01');
  });
});

describe('fillPeriodGaps', () => {
  it('returns a single entry when first equals last', () => {
    expect(fillPeriodGaps('2026-01-01', '2026-01-01', 'month')).toEqual(['2026-01-01']);
  });

  it('zero-fills every month between first and last, inclusive', () => {
    expect(fillPeriodGaps('2025-11-01', '2026-02-01', 'month')).toEqual([
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
    ]);
  });

  it('fills a quarter range', () => {
    expect(fillPeriodGaps('2025-07-01', '2026-01-01', 'quarter')).toEqual([
      '2025-07-01',
      '2025-10-01',
      '2026-01-01',
    ]);
  });
});

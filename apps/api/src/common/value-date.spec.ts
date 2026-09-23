import { isValueDate, MAX_VALUE_DATE, MIN_VALUE_DATE } from './value-date';

describe('isValueDate', () => {
  it.each([MIN_VALUE_DATE, MAX_VALUE_DATE, '2026-01-31', '2024-02-29', '2000-02-29'])(
    'accepts %s',
    (date) => {
      expect(isValueDate(date)).toBe(true);
    },
  );

  // The dates that made a single chart walk a million periods: see
  // reports/chart/period.ts.
  it.each(['0001-01-01', '1899-12-31', '2101-01-01', '9999-12-31'])(
    'rejects %s, outside the accepted range',
    (date) => {
      expect(isValueDate(date)).toBe(false);
    },
  );

  it.each(['2024-02-30', '2023-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-00-10'])(
    'rejects %s, which is not a real calendar day',
    (date) => {
      expect(isValueDate(date)).toBe(false);
    },
  );

  // Shapes the old @IsDateString() accepted (any ISO 8601 form) but the
  // `date` columns and web date inputs never produce.
  it.each(['2026-01-01T00:00:00Z', '2026-W01-1', '2026-001', '+2026-01-01', '2026-1-1', ''])(
    'rejects %s, which is not a plain YYYY-MM-DD date',
    (date) => {
      expect(isValueDate(date)).toBe(false);
    },
  );

  it.each([undefined, null, 20260101, new Date('2026-01-01')])('rejects non-string %p', (value) => {
    expect(isValueDate(value)).toBe(false);
  });
});

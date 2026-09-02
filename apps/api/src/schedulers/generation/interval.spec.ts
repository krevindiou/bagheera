import fc from 'fast-check';
import {
  dueOccurrences,
  FrequencyUnit,
  MAX_OCCURRENCES_PER_RUN,
  occurrenceDate,
} from './interval';

describe('occurrenceDate', () => {
  it('clamps Jan 31 + 1 month to Feb 28, then returns to day 31 in March', () => {
    expect(occurrenceDate('2026-01-31', 'month', 1, 0)).toBe('2026-01-31');
    expect(occurrenceDate('2026-01-31', 'month', 1, 1)).toBe('2026-02-28');
    expect(occurrenceDate('2026-01-31', 'month', 1, 2)).toBe('2026-03-31');
  });

  it('clamps Jan 31 + 1 month to Feb 29 on a leap year', () => {
    expect(occurrenceDate('2024-01-31', 'month', 1, 1)).toBe('2024-02-29');
  });

  it('clamps Feb 29 + 1 year to Feb 28 on a non-leap year', () => {
    expect(occurrenceDate('2024-02-29', 'year', 1, 1)).toBe('2025-02-28');
  });

  it('steps days and weeks by plain calendar arithmetic', () => {
    expect(occurrenceDate('2026-01-01', 'day', 3, 2)).toBe('2026-01-07');
    expect(occurrenceDate('2026-01-01', 'week', 2, 1)).toBe('2026-01-15');
  });

  it('occurrence 0 is always the value date', () => {
    expect(occurrenceDate('2026-06-15', 'month', 5, 0)).toBe('2026-06-15');
  });
});

describe('occurrenceDate (property)', () => {
  const unitArb: fc.Arbitrary<FrequencyUnit> = fc.constantFrom(
    'day',
    'week',
    'month',
    'year',
  );

  // Valid calendar dates only, kept in a reasonable range.
  const dateArb = fc
    .date({
      min: new Date('2000-01-01'),
      max: new Date('2100-01-01'),
      noInvalidDate: true,
    })
    .map((d) => d.toISOString().slice(0, 10));

  it('is monotonically non-decreasing as n grows, for any anchor/interval', () => {
    fc.assert(
      fc.property(
        dateArb,
        unitArb,
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 0, max: 40 }),
        (valueDate, unit, value, n) => {
          const a = occurrenceDate(valueDate, unit, value, n);
          const b = occurrenceDate(valueDate, unit, value, n + 1);
          expect(b >= a).toBe(true);
        },
      ),
    );
  });

  it('occurrence 0 always equals the anchor value date', () => {
    fc.assert(
      fc.property(
        dateArb,
        unitArb,
        fc.integer({ min: 1, max: 12 }),
        (valueDate, unit, value) => {
          expect(occurrenceDate(valueDate, unit, value, 0)).toBe(valueDate);
        },
      ),
    );
  });
});

describe('dueOccurrences', () => {
  it('returns nothing when the limit date is before the first due date', () => {
    expect(
      dueOccurrences({
        valueDate: '2026-06-01',
        frequencyUnit: 'month',
        frequencyValue: 1,
        after: null,
        horizon: '2026-05-01',
      }),
    ).toEqual([]);
  });

  it('includes an occurrence falling exactly on the horizon', () => {
    expect(
      dueOccurrences({
        valueDate: '2026-01-01',
        frequencyUnit: 'month',
        frequencyValue: 1,
        after: null,
        horizon: '2026-03-01',
      }),
    ).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
  });

  it('generates every occurrence missed during a long absence, in one catch-up', () => {
    expect(
      dueOccurrences({
        valueDate: '2025-01-15',
        frequencyUnit: 'month',
        frequencyValue: 1,
        after: null,
        horizon: '2026-01-15',
      }),
    ).toHaveLength(13);
  });

  it('resumes strictly after the latest already-generated occurrence', () => {
    expect(
      dueOccurrences({
        valueDate: '2026-01-01',
        frequencyUnit: 'week',
        frequencyValue: 1,
        after: '2026-01-15',
        horizon: '2026-02-01',
      }),
    ).toEqual(['2026-01-22', '2026-01-29']);
  });

  it('caps the occurrences returned by one call, however large the backlog', () => {
    // 30 years of daily occurrences (~10,957) is far past the cap.
    const dates = dueOccurrences({
      valueDate: '2000-01-01',
      frequencyUnit: 'day',
      frequencyValue: 1,
      after: null,
      horizon: '2030-01-01',
    });
    expect(dates).toHaveLength(MAX_OCCURRENCES_PER_RUN);
    expect(dates[0]).toBe('2000-01-01');
    expect(dates[dates.length - 1] < '2030-01-01').toBe(true);
  });

  it('works through a capped backlog across repeated calls, making forward progress each time', () => {
    const params = {
      valueDate: '2000-01-01',
      frequencyUnit: 'day' as const,
      frequencyValue: 1,
      horizon: '2030-01-01',
    };
    const first = dueOccurrences({ ...params, after: null });
    const second = dueOccurrences({
      ...params,
      after: first[first.length - 1],
    });
    expect(second).toHaveLength(MAX_OCCURRENCES_PER_RUN);
    expect(second[0] > first[first.length - 1]).toBe(true);
  });
});

describe('dueOccurrences (property)', () => {
  const unitArb: fc.Arbitrary<FrequencyUnit> = fc.constantFrom(
    'day',
    'week',
    'month',
    'year',
  );
  const dateArb = fc
    .date({
      min: new Date('2000-01-01'),
      max: new Date('2050-01-01'),
      noInvalidDate: true,
    })
    .map((d) => d.toISOString().slice(0, 10));

  it('every returned date is strictly increasing and within (after, horizon]', () => {
    fc.assert(
      fc.property(
        dateArb,
        unitArb,
        fc.integer({ min: 1, max: 6 }),
        dateArb,
        (valueDate, unit, value, horizon) => {
          const dates = dueOccurrences({
            valueDate,
            frequencyUnit: unit,
            frequencyValue: value,
            after: null,
            horizon,
          });
          for (let i = 0; i < dates.length; i++) {
            expect(dates[i] <= horizon).toBe(true);
            if (i > 0) {
              expect(dates[i] > dates[i - 1]).toBe(true);
            }
          }
        },
      ),
    );
  });
});

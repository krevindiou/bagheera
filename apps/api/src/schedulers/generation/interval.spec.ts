import { dueOccurrences, MAX_OCCURRENCES_PER_RUN, occurrenceDate } from './interval';

describe('occurrenceDate', () => {
  it('occurrence 0 is the value date itself, for any unit', () => {
    expect(occurrenceDate('2026-01-15', 'month', 3, 0)).toBe('2026-01-15');
  });

  it('adds whole days', () => {
    expect(occurrenceDate('2026-01-01', 'day', 10, 1)).toBe('2026-01-11');
  });

  it('adds whole weeks', () => {
    expect(occurrenceDate('2026-01-01', 'week', 2, 1)).toBe('2026-01-15');
  });

  it('adds whole months, multiplying value by n', () => {
    expect(occurrenceDate('2026-01-01', 'month', 2, 3)).toBe('2026-07-01');
  });

  it('adds whole years', () => {
    expect(occurrenceDate('2026-01-01', 'year', 1, 5)).toBe('2031-01-01');
  });

  it("clamps a month-end anchor to the target month's last day, without moving the anchor itself", () => {
    // Documented example: Jan 31 -> Feb 28 -> Mar 31 (the anchor day is
    // unaffected; only the clamped Feb occurrence loses it).
    expect(occurrenceDate('2025-01-31', 'month', 1, 0)).toBe('2025-01-31');
    expect(occurrenceDate('2025-01-31', 'month', 1, 1)).toBe('2025-02-28');
    expect(occurrenceDate('2025-01-31', 'month', 1, 2)).toBe('2025-03-31');
  });

  it('clamps a leap-day anchor for a non-leap target year', () => {
    expect(occurrenceDate('2024-02-29', 'year', 1, 1)).toBe('2025-02-28');
  });
});

describe('dueOccurrences', () => {
  it('includes occurrence 0 when nothing has been generated yet', () => {
    const dates = dueOccurrences({
      valueDate: '2026-01-01',
      frequencyUnit: 'month',
      frequencyValue: 1,
      after: null,
      horizon: '2026-01-01',
    });
    expect(dates).toEqual(['2026-01-01']);
  });

  it('excludes everything at or before `after`, including an exact match', () => {
    const dates = dueOccurrences({
      valueDate: '2026-01-01',
      frequencyUnit: 'month',
      frequencyValue: 1,
      after: '2026-02-01',
      horizon: '2026-04-01',
    });
    expect(dates).toEqual(['2026-03-01', '2026-04-01']);
  });

  it('includes a date exactly on the horizon, excludes the one after it', () => {
    const dates = dueOccurrences({
      valueDate: '2026-01-01',
      frequencyUnit: 'month',
      frequencyValue: 1,
      after: null,
      horizon: '2026-03-01',
    });
    expect(dates).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
  });

  it('returns nothing when the first occurrence is already past the horizon', () => {
    const dates = dueOccurrences({
      valueDate: '2026-05-01',
      frequencyUnit: 'month',
      frequencyValue: 1,
      after: null,
      horizon: '2026-01-01',
    });
    expect(dates).toEqual([]);
  });

  it('caps a large backlog at MAX_OCCURRENCES_PER_RUN, starting from the earliest due date', () => {
    const dates = dueOccurrences({
      valueDate: '2020-01-01',
      frequencyUnit: 'day',
      frequencyValue: 1,
      after: null,
      horizon: '2030-01-01', // far more than 1000 days out
    });
    expect(dates).toHaveLength(MAX_OCCURRENCES_PER_RUN);
    expect(dates[0]).toBe('2020-01-01');
    // Chronological order, and exactly 999 days between the first and last
    // entry — confirms the cap stops at the 1000th *earliest* due date
    // rather than some other subset.
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] > dates[i - 1]).toBe(true);
    }
    const spanDays =
      (new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) /
      (24 * 60 * 60 * 1000);
    expect(spanDays).toBe(MAX_OCCURRENCES_PER_RUN - 1);
  });

  it('resumes from just after the last generated date, not from occurrence 0', () => {
    const dates = dueOccurrences({
      valueDate: '2020-01-01',
      frequencyUnit: 'day',
      frequencyValue: 1,
      after: '2020-06-01',
      horizon: '2030-01-01',
    });
    expect(dates).toHaveLength(MAX_OCCURRENCES_PER_RUN);
    expect(dates[0]).toBe('2020-06-02');
  });
});

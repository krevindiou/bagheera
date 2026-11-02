import type { FrequencyUnit } from '@bagheera/reference-data';
import {
  countDueOccurrences,
  dueOccurrences,
  MAX_OCCURRENCES_PER_RUN,
  nextOccurrence,
  occurrenceDate,
} from './interval';

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

  describe('limit', () => {
    const daily = {
      valueDate: '2020-01-01',
      frequencyUnit: 'day' as const,
      frequencyValue: 1,
      after: null,
      horizon: '2030-01-01',
    };

    it('stops at a smaller limit — what a shared budget has left', () => {
      expect(dueOccurrences({ ...daily, limit: 3 })).toEqual([
        '2020-01-01',
        '2020-01-02',
        '2020-01-03',
      ]);
    });

    it('returns nothing once the budget is spent', () => {
      expect(dueOccurrences({ ...daily, limit: 0 })).toEqual([]);
    });

    it('never goes past MAX_OCCURRENCES_PER_RUN, however high', () => {
      expect(dueOccurrences({ ...daily, limit: MAX_OCCURRENCES_PER_RUN * 2 })).toHaveLength(
        MAX_OCCURRENCES_PER_RUN,
      );
    });
  });
});

// Every occurrence up to `horizon`, stepping from index 0.
function naiveOccurrences(
  valueDate: string,
  frequencyUnit: FrequencyUnit,
  frequencyValue: number,
  horizon: string,
): string[] {
  const dates: string[] = [];
  for (let n = 0; ; n++) {
    const date = occurrenceDate(valueDate, frequencyUnit, frequencyValue, n);
    if (date > horizon) {
      return dates;
    }
    dates.push(date);
  }
}

function addIsoDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe('starting near the cursor', () => {
  it('serves a daily scheduler anchored far back with a recent cursor', () => {
    const params = {
      valueDate: '1900-01-01',
      frequencyUnit: 'day' as const,
      frequencyValue: 1,
      after: '2026-10-30',
      horizon: '2026-11-03',
    };
    expect(dueOccurrences(params)).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ]);
    expect(nextOccurrence({ ...params, limitDate: null, active: true })).toBe('2026-10-31');
    expect(countDueOccurrences(params)).toBe(4);
  });

  it('does not walk from the value date to reach a far cursor', () => {
    const params = {
      valueDate: '1900-01-01',
      frequencyUnit: 'day' as const,
      frequencyValue: 1,
      after: '2026-10-30',
      limitDate: null,
      active: true,
    };
    // ~46,000 steps each when walking from index 0.
    const start = performance.now();
    for (let i = 0; i < 2000; i++) {
      nextOccurrence(params);
    }
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it('yields from occurrence 0 when the value date is after the cursor', () => {
    expect(
      dueOccurrences({
        valueDate: '2026-05-10',
        frequencyUnit: 'month',
        frequencyValue: 3,
        after: '2020-01-01',
        horizon: '2026-12-31',
      }),
    ).toEqual(['2026-05-10', '2026-08-10', '2026-11-10']);
  });

  const anchors = [
    '1900-01-31',
    '2023-12-31',
    '2024-01-29',
    '2024-01-30',
    '2024-01-31',
    '2024-02-29',
    '2024-03-31',
    '2024-04-30',
    '2024-05-31',
    '2024-08-31',
    '2025-01-31',
    '2026-11-30',
  ];
  const units = ['day', 'week', 'month', 'year'] as const;
  const values = [1, 2, 3, 5, 7, 12, 13];

  describe.each(anchors)('anchored on %s', (valueDate) => {
    it.each(units)('matches stepping from 0 for every %s interval', (frequencyUnit) => {
      for (const frequencyValue of values) {
        const horizon = `${Number(valueDate.slice(0, 4)) + 6}-12-31`;
        const all = naiveOccurrences(valueDate, frequencyUnit, frequencyValue, horizon);
        // Cursors on, a day either side of, and between the occurrences, plus
        // ones before the first and past the last.
        const cursors = new Set<string | null>([null, addIsoDays(valueDate, -1), horizon]);
        for (const date of all.slice(0, 30)) {
          cursors.add(date);
          cursors.add(addIsoDays(date, -1));
          cursors.add(addIsoDays(date, 1));
        }
        for (const after of cursors) {
          const expected = all.filter((date) => after === null || date > after);
          const params = { valueDate, frequencyUnit, frequencyValue, after, horizon };
          const label = `${frequencyUnit} x${frequencyValue} after ${after}`;
          expect(dueOccurrences({ ...params, limit: MAX_OCCURRENCES_PER_RUN }), label).toEqual(
            expected.slice(0, MAX_OCCURRENCES_PER_RUN),
          );
          expect(countDueOccurrences(params), label).toBe(expected.length);
          expect(nextOccurrence({ ...params, limitDate: horizon, active: true }), label).toBe(
            expected[0] ?? null,
          );
        }
      }
    });
  });
});

describe('countDueOccurrences', () => {
  const daily = { valueDate: '2020-01-01', frequencyUnit: 'day', frequencyValue: 1 } as const;

  it('counts a whole backlog, past the per-run ceiling', () => {
    // 2020-01-01 through 2030-01-01 inclusive, three leap years included.
    expect(countDueOccurrences({ ...daily, after: null, horizon: '2030-01-01' })).toBe(3654);
  });

  it('counts only what comes after the generation cursor', () => {
    expect(countDueOccurrences({ ...daily, after: '2020-01-29', horizon: '2020-01-31' })).toBe(2);
  });

  it('is 0 when the first occurrence is past the horizon', () => {
    expect(countDueOccurrences({ ...daily, after: null, horizon: '2019-12-31' })).toBe(0);
  });

  it('agrees with dueOccurrences under the ceiling', () => {
    const params = { ...daily, after: null, horizon: '2020-03-15' };
    expect(countDueOccurrences(params)).toBe(dueOccurrences(params).length);
  });
});

describe('nextOccurrence', () => {
  const monthly = {
    valueDate: '2026-07-05',
    frequencyUnit: 'month' as const,
    frequencyValue: 1,
    after: null,
    limitDate: null,
    active: true,
  };

  it('is the first occurrence while nothing has been generated', () => {
    expect(nextOccurrence(monthly)).toBe('2026-07-05');
  });

  it('is the occurrence right after the generation cursor', () => {
    expect(nextOccurrence({ ...monthly, after: '2026-10-05' })).toBe('2026-11-05');
  });

  it('follows the same month-end clamping as generation', () => {
    expect(nextOccurrence({ ...monthly, valueDate: '2025-01-31', after: '2025-01-31' })).toBe(
      '2025-02-28',
    );
    expect(nextOccurrence({ ...monthly, valueDate: '2025-01-31', after: '2025-02-28' })).toBe(
      '2025-03-31',
    );
  });

  it('agrees with dueOccurrences on what the next run generates', () => {
    const after = '2026-08-05';
    const [due] = dueOccurrences({ ...monthly, after, horizon: '2030-01-01', limit: 1 });
    expect(nextOccurrence({ ...monthly, after })).toBe(due);
  });

  it('is null while paused', () => {
    expect(nextOccurrence({ ...monthly, active: false })).toBeNull();
  });

  it('includes an occurrence exactly on the limit date', () => {
    expect(nextOccurrence({ ...monthly, after: '2026-09-05', limitDate: '2026-10-05' })).toBe(
      '2026-10-05',
    );
  });

  it('is null once the next occurrence would fall after the limit date', () => {
    expect(nextOccurrence({ ...monthly, after: '2026-10-05', limitDate: '2026-11-01' })).toBeNull();
  });

  it('is null when the limit date precedes the first occurrence', () => {
    expect(nextOccurrence({ ...monthly, limitDate: '2026-07-01' })).toBeNull();
  });
});

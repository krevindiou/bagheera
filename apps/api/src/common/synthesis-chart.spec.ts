import { computeSynthesisChart } from './synthesis-chart';

describe('computeSynthesisChart', () => {
  const TODAY = '2026-08-23';

  it('is hidden when there are no operations at all', () => {
    expect(computeSynthesisChart([], TODAY)).toEqual({
      hidden: true,
      axisBounds: null,
      series: [],
    });
  });

  it('produces 12 monthly points ending at the current month', () => {
    const result = computeSynthesisChart(
      [
        {
          currency: 'USD',
          debit: null,
          credit: 100000,
          valueDate: '2026-08-01',
        },
      ],
      TODAY,
    );
    expect(result.hidden).toBe(false);
    expect(result.series).toHaveLength(1);
    expect(result.series[0].points).toHaveLength(12);
    expect(result.series[0].points[0].period).toBe('2025-09-01');
    expect(result.series[0].points.at(-1)!.period).toBe('2026-08-01');
  });

  it('carries a pre-window balance forward and repeats it through months with no movement', () => {
    const rows = [
      // 13 months before "today" — outside the 12-month window, folded
      // into the running total's starting point.
      { currency: 'USD', debit: null, credit: 300000, valueDate: '2025-07-15' },
      // 2 months before "today".
      { currency: 'USD', debit: 50000, credit: null, valueDate: '2026-06-10' },
      // Current month.
      { currency: 'USD', debit: null, credit: 200000, valueDate: TODAY },
    ];
    const result = computeSynthesisChart(rows, TODAY);
    const points = result.series[0].points;
    expect(points).toHaveLength(12);
    // 2025-09 .. 2026-05: flat at the carried-over 30.
    for (const point of points.slice(0, 9)) {
      expect(point.value).toBe(30);
    }
    // 2026-06 (the debit month) and 2026-07 (still flat): 30 - 5 = 25.
    expect(points[9]).toEqual({ period: '2026-06-01', value: 25 });
    expect(points[10]).toEqual({ period: '2026-07-01', value: 25 });
    // 2026-08 (current month): 25 + 20 = 45.
    expect(points[11]).toEqual({ period: '2026-08-01', value: 45 });
  });

  it('keeps currencies in separate series, sorted, with no cross-currency conversion', () => {
    const result = computeSynthesisChart(
      [
        { currency: 'EUR', debit: null, credit: 100000, valueDate: TODAY },
        { currency: 'USD', debit: null, credit: 500000, valueDate: TODAY },
      ],
      TODAY,
    );
    expect(result.series.map((s) => s.currency)).toEqual(['EUR', 'USD']);
    expect(result.series[0].points.at(-1)!.value).toBe(10);
    expect(result.series[1].points.at(-1)!.value).toBe(50);
  });
});

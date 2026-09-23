import {
  computeSynthesisChart,
  earliestValueDate,
  latestValueDate,
  parseSynthesisChartWindow,
  SynthesisChartRow,
} from './synthesis-chart';
import { MinorUnits } from './money';
import { MAX_PERIODS } from '../reports/chart/period';

// Fixed "today" so the 12-month trailing window is deterministic:
// currentMonth = 2026-03-01, windowStart = 2025-04-01.
const TODAY = '2026-03-15';

function minor(n: number): MinorUnits {
  return n as MinorUnits;
}

describe('computeSynthesisChart', () => {
  it('is hidden with no series when there are no rows', () => {
    expect(computeSynthesisChart([], TODAY)).toEqual({
      hidden: true,
      axisBounds: null,
      series: [],
    });
  });

  it('zero-fills months before any movement and carries the balance forward after', () => {
    const rows: SynthesisChartRow[] = [
      {
        currency: 'USD',
        debit: null,
        credit: minor(10000),
        valueDate: '2026-01-15',
      },
    ];
    const chart = computeSynthesisChart(rows, TODAY);
    expect(chart.hidden).toBe(false);
    expect(chart.series).toHaveLength(1);
    const { points } = chart.series[0];
    expect(points).toHaveLength(12);
    // Window is 2025-04 .. 2026-03; the credit lands in 2026-01, the 10th point.
    expect(points.slice(0, 9).map((p) => p.value)).toEqual(Array(9).fill(0));
    expect(points.slice(9).map((p) => p.value)).toEqual([1, 1, 1]);
    expect(points[9].period).toBe('2026-01-01');
  });

  it('treats a row with neither debit nor credit set as a net-zero, no-op movement', () => {
    const rows: SynthesisChartRow[] = [
      { currency: 'USD', debit: null, credit: null, valueDate: '2026-01-15' },
    ];
    const chart = computeSynthesisChart(rows, TODAY);
    expect(chart.series[0].points.map((p) => p.value)).toEqual(Array(12).fill(0));
  });

  it('folds a row dated before the window into the carried-forward starting balance', () => {
    const rows: SynthesisChartRow[] = [
      {
        currency: 'USD',
        debit: minor(10000),
        credit: null,
        valueDate: '2024-01-01',
      },
    ];
    const chart = computeSynthesisChart(rows, TODAY);
    const { points } = chart.series[0];
    // Every point in the window carries the same -1, since nothing moves inside it.
    expect(points.map((p) => p.value)).toEqual(Array(12).fill(-1));
  });

  it('accumulates multiple rows for the same currency onto one shared entry, not a fresh one each time', () => {
    const rows: SynthesisChartRow[] = [
      {
        currency: 'USD',
        debit: null,
        credit: minor(10000),
        valueDate: '2026-01-10',
      },
      {
        currency: 'USD',
        debit: null,
        credit: minor(20000),
        valueDate: '2026-02-05',
      },
    ];
    const chart = computeSynthesisChart(rows, TODAY);
    expect(chart.series).toHaveLength(1); // one entry for USD, not two
    const jan = chart.series[0].points.find((p) => p.period === '2026-01-01');
    const feb = chart.series[0].points.find((p) => p.period === '2026-02-01');
    expect(jan?.value).toBe(1);
    expect(feb?.value).toBe(3); // carried forward: 1 + 2
  });

  it('nets credit minus debit within the same month', () => {
    const rows: SynthesisChartRow[] = [
      {
        currency: 'USD',
        debit: minor(30000),
        credit: minor(50000),
        valueDate: '2026-02-01',
      },
    ];
    const chart = computeSynthesisChart(rows, TODAY);
    const feb = chart.series[0].points.find((p) => p.period === '2026-02-01');
    expect(feb?.value).toBe(2);
  });

  it('returns one series per currency, sorted alphabetically', () => {
    const rows: SynthesisChartRow[] = [
      {
        currency: 'USD',
        debit: null,
        credit: minor(10000),
        valueDate: '2026-01-01',
      },
      {
        currency: 'EUR',
        debit: null,
        credit: minor(20000),
        valueDate: '2026-01-01',
      },
    ];
    const chart = computeSynthesisChart(rows, TODAY);
    expect(chart.series.map((s) => s.currency)).toEqual(['EUR', 'USD']);
  });

  it('computes axisBounds from the series data range', () => {
    const rows: SynthesisChartRow[] = [
      {
        currency: 'USD',
        debit: null,
        credit: minor(10000),
        valueDate: '2026-01-01',
      },
    ];
    const chart = computeSynthesisChart(rows, TODAY);
    // dataMin=0, dataMax=1 -> spread=1 -> 5% padding of 0.05.
    expect(chart.axisBounds?.min).toBeCloseTo(-0.05, 6);
    expect(chart.axisBounds?.max).toBeCloseTo(1.05, 6);
  });

  it('defaults `today` to the real current date when omitted', () => {
    // Just confirms the parameter is truly optional and produces a chart at all.
    const rows: SynthesisChartRow[] = [
      {
        currency: 'USD',
        debit: null,
        credit: minor(10000),
        valueDate: '2020-01-01',
      },
    ];
    const chart = computeSynthesisChart(rows);
    expect(chart.hidden).toBe(false);
    expect(chart.series[0].points).toHaveLength(12);
  });

  it('ends the window at a `today` earlier than any row, without erroring', () => {
    // Not a realistic caller (every row would fall after the window), but
    // guards against an off-by-one blowing up `fillPeriodGaps`.
    const rows: SynthesisChartRow[] = [
      { currency: 'USD', debit: null, credit: minor(10000), valueDate: '2026-06-01' },
    ];
    const chart = computeSynthesisChart(rows, '2025-01-01');
    expect(chart.series[0].points).toHaveLength(12);
    expect(chart.series[0].points[11]?.period).toBe('2025-01-01');
  });

  it('widens the window to 24 months when passed windowMonths=24', () => {
    const rows: SynthesisChartRow[] = [
      { currency: 'USD', debit: null, credit: minor(10000), valueDate: '2026-01-15' },
    ];
    const chart = computeSynthesisChart(rows, TODAY, 24);
    expect(chart.series[0].points).toHaveLength(24);
    // Window is 2024-04 .. 2026-03 (24 months ending at `currentMonth`).
    expect(chart.series[0].points[0].period).toBe('2024-04-01');
  });

  it("spans the full history, anchored at the earliest row's month, when passed windowMonths='all'", () => {
    const rows: SynthesisChartRow[] = [
      { currency: 'USD', debit: null, credit: minor(10000), valueDate: '2018-06-15' },
      { currency: 'USD', debit: minor(5000), credit: null, valueDate: '2026-01-01' },
    ];
    const chart = computeSynthesisChart(rows, TODAY, 'all');
    const { points } = chart.series[0];
    expect(points[0].period).toBe('2018-06-01');
    expect(points[points.length - 1].period).toBe('2026-03-01');
    // Every row folds into the window (nothing carried into `before`), so
    // the earliest month already reflects the first credit.
    expect(points[0].value).toBe(1);
  });

  // Regression: a row dated 9999-12-31 used to turn this default 12-month
  // window into ~1.08 million points (see fillPeriodGaps).
  it('keeps a 12-point window when the latest row is dated in year 9999', () => {
    const rows: SynthesisChartRow[] = [
      { currency: 'USD', debit: null, credit: minor(10000), valueDate: '2026-01-15' },
      { currency: 'USD', debit: null, credit: minor(10000), valueDate: '9999-12-31' },
    ];
    const chart = computeSynthesisChart(rows, latestValueDate(rows));
    const { points } = chart.series[0];
    expect(points).toHaveLength(12);
    expect(points[11].period).toBe('9999-12-01');
    expect(points[11].value).toBe(2);
  });

  it("caps an 'all' window at MAX_PERIODS months, carrying older rows into the first point", () => {
    const rows: SynthesisChartRow[] = [
      { currency: 'USD', debit: null, credit: minor(10000), valueDate: '0202-05-01' },
      { currency: 'USD', debit: null, credit: minor(10000), valueDate: '2026-01-15' },
    ];
    const chart = computeSynthesisChart(rows, TODAY, 'all');
    const { points } = chart.series[0];
    expect(points).toHaveLength(MAX_PERIODS);
    expect(points.at(-1)?.period).toBe('2026-03-01');
    // The 0202 row sits before the capped axis: it must still count, via
    // the carried-over starting balance, not vanish.
    expect(points[0].value).toBe(1);
    expect(points.at(-1)?.value).toBe(2);
  });

  it("plots nothing for an 'all' window whose `today` precedes every row", () => {
    const rows: SynthesisChartRow[] = [
      { currency: 'USD', debit: null, credit: minor(10000), valueDate: '2026-06-01' },
    ];
    const chart = computeSynthesisChart(rows, '2025-01-01', 'all');
    expect(chart.series[0].points).toEqual([]);
  });
});

describe('latestValueDate', () => {
  it('is undefined for no rows', () => {
    expect(latestValueDate([])).toBeUndefined();
  });

  it('picks the latest valueDate regardless of row order', () => {
    expect(
      latestValueDate([
        { valueDate: '2026-01-15' },
        { valueDate: '2020-06-01' },
        { valueDate: '2026-03-02' },
      ]),
    ).toBe('2026-03-02');
  });
});

describe('earliestValueDate', () => {
  it('is undefined for no rows', () => {
    expect(earliestValueDate([])).toBeUndefined();
  });

  it('picks the earliest valueDate regardless of row order', () => {
    expect(
      earliestValueDate([
        { valueDate: '2026-01-15' },
        { valueDate: '2020-06-01' },
        { valueDate: '2026-03-02' },
      ]),
    ).toBe('2020-06-01');
  });
});

describe('parseSynthesisChartWindow', () => {
  it('defaults to 12 for undefined/missing/unrecognized values', () => {
    expect(parseSynthesisChartWindow(undefined)).toBe(12);
    expect(parseSynthesisChartWindow('')).toBe(12);
    expect(parseSynthesisChartWindow('bogus')).toBe(12);
    expect(parseSynthesisChartWindow('12')).toBe(12);
  });

  it("parses '24' and 'all'", () => {
    expect(parseSynthesisChartWindow('24')).toBe(24);
    expect(parseSynthesisChartWindow('all')).toBe('all');
  });
});

// Shared "synthesis chart" aggregation — the cumulative end-of-month
// balance for each of the last 12 months, one line per currency (spec
// 4.14 item 2). Used by both the dashboard and the per-account chart: they
// are explicitly "the same chart", the account one just scoped to a single
// account/currency (spec 4.14 note).

import { AxisBounds, computeAxisBounds } from './chart-axis';
import { MinorUnits, toMajorUnits } from './money';
import {
  addMonths,
  fillPeriodGaps,
  periodStart,
} from '../reports/chart/period';

const WINDOW_MONTHS = 12;

export interface SynthesisChartPoint {
  period: string;
  value: number;
}

export interface SynthesisChartSeries {
  currency: string;
  points: SynthesisChartPoint[];
}

export interface SynthesisChart {
  hidden: boolean;
  axisBounds: AxisBounds | null;
  series: SynthesisChartSeries[];
}

export interface SynthesisChartRow {
  currency: string;
  debit: MinorUnits | null;
  credit: MinorUnits | null;
  valueDate: string;
}

// `today` is injectable for tests; defaults to the real current date.
export function computeSynthesisChart(
  rows: SynthesisChartRow[],
  today: string = new Date().toISOString().slice(0, 10),
): SynthesisChart {
  if (rows.length === 0) {
    return { hidden: true, axisBounds: null, series: [] };
  }

  const currentMonth = periodStart(today, 'month');
  const windowStart = addMonths(currentMonth, -(WINDOW_MONTHS - 1));
  const months = fillPeriodGaps(windowStart, currentMonth, 'month');

  // Per currency: `before` carries every operation dated strictly before
  // the window (the "carried-over balance from before the window"),
  // `byMonth` holds each in-window month's own net movement.
  const byCurrency = new Map<
    string,
    { before: number; byMonth: Map<string, number> }
  >();
  for (const row of rows) {
    let entry = byCurrency.get(row.currency);
    if (!entry) {
      entry = { before: 0, byMonth: new Map() };
      byCurrency.set(row.currency, entry);
    }
    const net = (row.credit ?? 0) - (row.debit ?? 0);
    const month = periodStart(row.valueDate, 'month');
    if (month < windowStart) {
      entry.before += net;
    } else {
      entry.byMonth.set(month, (entry.byMonth.get(month) ?? 0) + net);
    }
  }

  const series: SynthesisChartSeries[] = [];
  let dataMin = Infinity;
  let dataMax = -Infinity;

  for (const currency of [...byCurrency.keys()].sort()) {
    const entry = byCurrency.get(currency)!;
    // Running cumulative balance, carried forward — a month with no
    // movement simply repeats the previous month's total.
    let running = entry.before;
    const points = months.map((month) => {
      running += entry.byMonth.get(month) ?? 0;
      // `running` is a plain-number accumulator — `+=` always widens back
      // to `number`, even when every addend started as MinorUnits. This
      // cast is the one place that says "done accumulating, this total is
      // still minor units."
      const value = toMajorUnits(running as MinorUnits);
      dataMin = Math.min(dataMin, value);
      dataMax = Math.max(dataMax, value);
      return { period: month, value };
    });
    series.push({ currency, points });
  }

  return {
    hidden: false,
    axisBounds: computeAxisBounds(dataMin, dataMax),
    series,
  };
}

// Shared "synthesis chart" aggregation — the cumulative end-of-month
// balance for a trailing window (12 or 24 months, or the full history),
// one line per currency (spec 4.14 item 2). Used by both the dashboard and
// the per-account chart: they are explicitly "the same chart", the account
// one just scoped to a single account/currency (spec 4.14 note).

import { AxisBounds, computeAxisBounds } from './chart-axis';
import { MinorUnits, toMajorUnits } from './money';
import { addMonths, fillPeriodGaps, periodStart } from '../reports/chart/period';

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

// The window ends at the latest operation actually in scope, not at
// today's calendar date — a member who stopped recording a month ago
// shouldn't see the chart trail off into empty recent months. Every
// `computeSynthesisChart` caller derives its `today` from this rather than
// letting the function's own real-date default apply (that default exists
// only for direct/test callers that don't go through here). ISO
// 'YYYY-MM-DD' strings compare correctly with plain `>`.
export function latestValueDate(rows: { valueDate: string }[]): string | undefined {
  return rows.reduce<string | undefined>(
    (latest, row) => (!latest || row.valueDate > latest ? row.valueDate : latest),
    undefined,
  );
}

// Mirror of `latestValueDate`, used to anchor the 'all' window's start at
// the earliest operation actually in scope, rather than an arbitrary
// far-past date.
export function earliestValueDate(rows: { valueDate: string }[]): string | undefined {
  return rows.reduce<string | undefined>(
    (earliest, row) => (!earliest || row.valueDate < earliest ? row.valueDate : earliest),
    undefined,
  );
}

export type SynthesisChartWindow = 12 | 24 | 'all';

// Parses the `range` query param shared by the dashboard and per-account
// chart endpoints. Any unrecognized/missing value falls back to the
// original 12-month default rather than rejecting the request — the range
// picker only ever sends one of these three, but a stale/hand-crafted
// query string shouldn't 400.
export function parseSynthesisChartWindow(range: unknown): SynthesisChartWindow {
  if (range === '24') return 24;
  if (range === 'all') return 'all';
  return 12;
}

// `today` is injectable for tests; defaults to the real current date. Real
// callers should pass `latestValueDate(rows)` instead — see above.
// `windowMonths` defaults to the original trailing-12-months behavior;
// pass a bigger count or 'all' (window starts at the earliest row's month,
// via `earliestValueDate`) to widen it — see spec 4.14's range selector.
export function computeSynthesisChart(
  rows: SynthesisChartRow[],
  today: string = new Date().toISOString().slice(0, 10),
  windowMonths: SynthesisChartWindow = WINDOW_MONTHS,
): SynthesisChart {
  if (rows.length === 0) {
    return { hidden: true, axisBounds: null, series: [] };
  }

  const currentMonth = periodStart(today, 'month');
  const requestedStart =
    windowMonths === 'all'
      ? periodStart(earliestValueDate(rows)!, 'month')
      : addMonths(currentMonth, -(windowMonths - 1));
  const months = fillPeriodGaps(requestedStart, currentMonth, 'month');
  // fillPeriodGaps caps how far back the axis can reach (MAX_PERIODS), so
  // the window starts wherever the axis actually starts — otherwise rows
  // between the requested and the capped start would land in neither
  // `before` nor any plotted month, silently dropping out of every running
  // balance. (Empty only for a `today` before the requested start.)
  const windowStart = months[0] ?? requestedStart;

  // Per currency: `before` carries every operation dated strictly before
  // the window (the "carried-over balance from before the window"),
  // `byMonth` holds each in-window month's own net movement.
  const byCurrency = new Map<string, { before: number; byMonth: Map<string, number> }>();
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

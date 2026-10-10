// "Synthesis chart": cumulative end-of-month balance over a trailing window
// (12 or 24 months, or the full history), one line per currency. Shared by
// the dashboard and the per-account chart.

import { computeAxisBounds } from './chart-axis';
import { localIsoDate } from './local-date';
import { MinorUnits } from './money';
import { addMonths, fillPeriodGaps, periodStart } from '../reports/chart/period';
import { SynthesisChartDto, SynthesisChartSeriesDto } from './dto/chart-response.dto';

const WINDOW_MONTHS = 12;

export type SynthesisChartSeries = SynthesisChartSeriesDto;

export type SynthesisChart = SynthesisChartDto;

export interface SynthesisChartRow {
  currency: string;
  debit: MinorUnits | null;
  credit: MinorUnits | null;
  valueDate: string;
}

// What callers pass as `computeSynthesisChart`'s `today`: the window ends at
// the latest operation in scope, so a member who stopped recording a month
// ago doesn't see the chart trail off into empty months.
export function latestValueDate(rows: { valueDate: string }[]): string | undefined {
  return rows.reduce<string | undefined>(
    (latest, row) => (!latest || row.valueDate > latest ? row.valueDate : latest),
    undefined,
  );
}

// Anchors the 'all' window's start.
export function earliestValueDate(rows: { valueDate: string }[]): string | undefined {
  return rows.reduce<string | undefined>(
    (earliest, row) => (!earliest || row.valueDate < earliest ? row.valueDate : earliest),
    undefined,
  );
}

export type SynthesisChartWindow = 12 | 24 | 'all';

// The `range` query param of the dashboard and per-account chart. Anything
// unrecognized falls back to 12 rather than a 400.
export function parseSynthesisChartWindow(range: unknown): SynthesisChartWindow {
  if (range === '24') return 24;
  if (range === 'all') return 'all';
  return 12;
}

// Real callers pass `latestValueDate(rows)` as `today`; the default is for
// tests. 'all' starts the window at the earliest row's month.
export function computeSynthesisChart(
  rows: SynthesisChartRow[],
  today: string = localIsoDate(),
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
  // fillPeriodGaps caps the axis at MAX_PERIODS, so start the window where
  // the axis does: rows between the requested and capped starts would
  // otherwise drop out of every running balance. (Empty only for a `today`
  // before the requested start.)
  const windowStart = months[0] ?? requestedStart;

  // Per currency: `before` sums everything dated before the window,
  // `byMonth` each in-window month's net movement.
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
    let running = entry.before;
    const points = months.map((month) => {
      running += entry.byMonth.get(month) ?? 0;
      // `+=` widens to `number`; the total is still minor units.
      const value = running as MinorUnits;
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

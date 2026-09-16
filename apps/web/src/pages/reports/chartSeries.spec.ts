import { describe, expect, it } from 'vitest';
import { colorForCurrency } from '../../components/chartColors';
import { toChartSeries } from './chartSeries';
import type { ReportChart } from './reports.types';

const t = (key: string) => key;

describe('toChartSeries', () => {
  it('returns a debit and a credit series for a currency with both, same color, debit dashed', () => {
    const chart: ReportChart = {
      hidden: false,
      axisBounds: null,
      series: [
        {
          currency: 'USD',
          debit: [{ period: '2026-01', value: 50 }],
          credit: [{ period: '2026-01', value: 20 }],
        },
      ],
    };
    const color = colorForCurrency('USD');
    expect(toChartSeries(chart, t)).toEqual([
      {
        label: 'USD operations.debit',
        color,
        dash: [8, 4],
        points: [{ period: '2026-01', value: 50 }],
      },
      {
        label: 'USD operations.credit',
        color,
        points: [{ period: '2026-01', value: 20 }],
      },
    ]);
  });

  it('omits the debit series for a currency with no debit points', () => {
    const chart: ReportChart = {
      hidden: false,
      axisBounds: null,
      series: [{ currency: 'USD', debit: [], credit: [{ period: '2026-01', value: 20 }] }],
    };
    expect(toChartSeries(chart, t)).toEqual([
      {
        label: 'USD operations.credit',
        color: colorForCurrency('USD'),
        points: [{ period: '2026-01', value: 20 }],
      },
    ]);
  });

  it('omits the credit series for a currency with no credit points', () => {
    const chart: ReportChart = {
      hidden: false,
      axisBounds: null,
      series: [{ currency: 'USD', debit: [{ period: '2026-01', value: 50 }], credit: [] }],
    };
    expect(toChartSeries(chart, t)).toEqual([
      {
        label: 'USD operations.debit',
        color: colorForCurrency('USD'),
        dash: [8, 4],
        points: [{ period: '2026-01', value: 50 }],
      },
    ]);
  });

  it('returns an empty list for a chart with no series', () => {
    expect(toChartSeries({ hidden: false, axisBounds: null, series: [] }, t)).toEqual([]);
  });

  it('gives each currency its own color, so two currencies stay distinguishable', () => {
    const chart: ReportChart = {
      hidden: false,
      axisBounds: null,
      series: [
        { currency: 'USD', debit: [{ period: '2026-01', value: 50 }], credit: [] },
        { currency: 'EUR', debit: [], credit: [{ period: '2026-01', value: 30 }] },
      ],
    };
    const usdColor = colorForCurrency('USD');
    const eurColor = colorForCurrency('EUR');
    expect(usdColor).not.toBe(eurColor);
    expect(toChartSeries(chart, t)).toEqual([
      {
        label: 'USD operations.debit',
        color: usdColor,
        dash: [8, 4],
        points: [{ period: '2026-01', value: 50 }],
      },
      {
        label: 'EUR operations.credit',
        color: eurColor,
        points: [{ period: '2026-01', value: 30 }],
      },
    ]);
  });
});

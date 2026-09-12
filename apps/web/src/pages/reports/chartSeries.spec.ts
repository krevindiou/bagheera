import { describe, expect, it } from 'vitest';
import { toChartSeries } from './chartSeries';
import type { ReportChart } from './reports.types';

const t = (key: string) => key;

describe('toChartSeries', () => {
  it('returns a debit and a credit series for a currency with both', () => {
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
    expect(toChartSeries(chart, t)).toEqual([
      {
        label: 'USD operations.debit',
        color: '#dc3545',
        points: [{ period: '2026-01', value: 50 }],
      },
      {
        label: 'USD operations.credit',
        color: '#198754',
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
        color: '#198754',
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
        color: '#dc3545',
        points: [{ period: '2026-01', value: 50 }],
      },
    ]);
  });

  it('returns an empty list for a chart with no series', () => {
    expect(toChartSeries({ hidden: false, axisBounds: null, series: [] }, t)).toEqual([]);
  });

  it('handles multiple currencies', () => {
    const chart: ReportChart = {
      hidden: false,
      axisBounds: null,
      series: [
        { currency: 'USD', debit: [{ period: '2026-01', value: 50 }], credit: [] },
        { currency: 'EUR', debit: [], credit: [{ period: '2026-01', value: 30 }] },
      ],
    };
    expect(toChartSeries(chart, t)).toEqual([
      {
        label: 'USD operations.debit',
        color: '#dc3545',
        points: [{ period: '2026-01', value: 50 }],
      },
      {
        label: 'EUR operations.credit',
        color: '#198754',
        points: [{ period: '2026-01', value: 30 }],
      },
    ]);
  });
});

import { toMinorUnits as m } from '@bagheera/money';
import { describe, expect, it } from 'vitest';
import { SYNTHESIS_COLORS } from '../../components/chartColors';
import { toDistributionFacets } from './distributionSeries';
import type { ReportDistribution } from './reports.types';

const t = (key: string) => key;
const OTHER_COLOR = '#8a837c';

describe('toDistributionFacets', () => {
  it('merges debit and credit into one snapshot facet per currency, debit negated', () => {
    const distribution: ReportDistribution = {
      hidden: false,
      dataGrouping: 'category',
      series: [
        {
          currency: 'USD',
          debit: [{ label: 'Food', points: [{ period: '2026-01-01', value: m(100) }] }],
          credit: [{ label: 'Salary', points: [{ period: '2026-01-01', value: m(500) }] }],
        },
      ],
    };
    expect(toDistributionFacets(distribution, t, 'month')).toEqual([
      {
        kind: 'snapshot',
        title: 'USD',
        currency: 'USD',
        bars: [
          { label: 'Salary', value: 500, color: SYNTHESIS_COLORS[0] },
          { label: 'Food', value: -100, color: SYNTHESIS_COLORS[1] },
        ],
      },
    ]);
  });

  it('orders the merged bars by magnitude regardless of side', () => {
    const distribution: ReportDistribution = {
      hidden: false,
      dataGrouping: 'category',
      series: [
        {
          currency: 'USD',
          debit: [
            { label: 'Rent', points: [{ period: '2026-01-01', value: m(1000) }] },
            { label: 'Coffee', points: [{ period: '2026-01-01', value: m(5) }] },
          ],
          credit: [{ label: 'Salary', points: [{ period: '2026-01-01', value: m(500) }] }],
        },
      ],
    };
    const facet = toDistributionFacets(distribution, t, 'month')[0];
    expect(facet).toMatchObject({ kind: 'snapshot' });
    if (facet.kind !== 'snapshot') throw new Error('expected snapshot');
    expect(facet.bars.map((b) => b.label)).toEqual(['Rent', 'Salary', 'Coffee']);
    expect(facet.bars.map((b) => b.value)).toEqual([-1000, 500, -5]);
  });

  it('labels a null debit bucket "Other expenses" with a muted, palette-independent color', () => {
    const distribution: ReportDistribution = {
      hidden: false,
      dataGrouping: 'category',
      series: [
        {
          currency: 'USD',
          debit: [
            { label: 'Food', points: [{ period: '2026-01-01', value: m(100) }] },
            { label: null, points: [{ period: '2026-01-01', value: m(10) }] },
          ],
          credit: [],
        },
      ],
    };
    expect(toDistributionFacets(distribution, t, 'month')).toEqual([
      {
        kind: 'snapshot',
        title: 'USD',
        currency: 'USD',
        bars: [
          { label: 'Food', value: -100, color: SYNTHESIS_COLORS[0] },
          { label: 'reports.otherExpenses', value: -10, color: OTHER_COLOR },
        ],
      },
    ]);
  });

  it('returns a temporal facet (multiple points per label) with debit series negated', () => {
    const distribution: ReportDistribution = {
      hidden: false,
      dataGrouping: 'category',
      series: [
        {
          currency: 'USD',
          debit: [
            {
              label: 'Food',
              points: [
                { period: '2026-01-01', value: m(100) },
                { period: '2026-02-01', value: 0 },
              ],
            },
          ],
          credit: [
            {
              label: 'Salary',
              points: [
                { period: '2026-01-01', value: m(500) },
                { period: '2026-02-01', value: m(500) },
              ],
            },
          ],
        },
      ],
    };
    expect(toDistributionFacets(distribution, t, 'month')).toEqual([
      {
        kind: 'temporal',
        title: 'USD',
        currency: 'USD',
        periodGrouping: 'month',
        series: [
          {
            label: 'Salary',
            color: SYNTHESIS_COLORS[0],
            points: [
              { period: '2026-01-01', value: 500 },
              { period: '2026-02-01', value: 500 },
            ],
          },
          {
            label: 'Food',
            color: SYNTHESIS_COLORS[1],
            points: [
              { period: '2026-01-01', value: -100 },
              { period: '2026-02-01', value: 0 },
            ],
          },
        ],
      },
    ]);
  });

  it('carries the report period grouping on temporal facets', () => {
    const distribution: ReportDistribution = {
      hidden: false,
      dataGrouping: 'category',
      series: [
        {
          currency: 'USD',
          debit: [
            {
              label: 'Food',
              points: [
                { period: '2025-01-01', value: m(100) },
                { period: '2026-01-01', value: m(50) },
              ],
            },
          ],
          credit: [],
        },
      ],
    };
    expect(toDistributionFacets(distribution, t, 'year')).toMatchObject([
      { kind: 'temporal', periodGrouping: 'year' },
    ]);
    expect(toDistributionFacets(distribution, t, 'quarter')).toMatchObject([
      { kind: 'temporal', periodGrouping: 'quarter' },
    ]);
  });

  it('omits a currency with neither debit nor credit data', () => {
    const distribution: ReportDistribution = {
      hidden: false,
      dataGrouping: 'category',
      series: [{ currency: 'USD', debit: [], credit: [] }],
    };
    expect(toDistributionFacets(distribution, t, 'month')).toEqual([]);
  });

  it('returns an empty list for a distribution with no series', () => {
    expect(
      toDistributionFacets({ hidden: false, dataGrouping: 'category', series: [] }, t, 'month'),
    ).toEqual([]);
  });

  it('labels the null credit and debit buckets apart, "Other income" and "Other expenses"', () => {
    const distribution: ReportDistribution = {
      hidden: false,
      dataGrouping: 'category',
      series: [
        {
          currency: 'USD',
          debit: [{ label: null, points: [{ period: '2026-01-01', value: m(10) }] }],
          credit: [{ label: null, points: [{ period: '2026-01-01', value: m(20) }] }],
        },
      ],
    };
    const facet = toDistributionFacets(distribution, t, 'month')[0];
    if (facet.kind !== 'snapshot') throw new Error('expected snapshot');
    expect(facet.bars.map((b) => [b.label, b.value, b.color])).toEqual([
      ['reports.otherIncome', 20, OTHER_COLOR],
      ['reports.otherExpenses', -10, OTHER_COLOR],
    ]);
  });

  it('labels both Other buckets apart in a temporal facet too', () => {
    const points = [
      { period: '2025-01-01', value: m(10) },
      { period: '2026-01-01', value: m(10) },
    ];
    const distribution: ReportDistribution = {
      hidden: false,
      dataGrouping: 'category',
      series: [
        {
          currency: 'USD',
          debit: [{ label: null, points }],
          credit: [{ label: null, points }],
        },
      ],
    };
    const facet = toDistributionFacets(distribution, t, 'year')[0];
    if (facet.kind !== 'temporal') throw new Error('expected temporal');
    expect(facet.series.map((s) => s.label)).toEqual([
      'reports.otherIncome',
      'reports.otherExpenses',
    ]);
  });

  it('gives each label in a chart its own color while the palette has room', () => {
    const labels = ['Leisure', 'Rent', 'Food', 'Transport', 'Health'];
    const distribution: ReportDistribution = {
      hidden: false,
      dataGrouping: 'category',
      series: [
        {
          currency: 'USD',
          debit: labels.map((label) => ({
            label,
            points: [{ period: '2026-01-01', value: m(10) }],
          })),
          credit: [{ label: 'Salary', points: [{ period: '2026-01-01', value: m(500) }] }],
        },
      ],
    };
    const facet = toDistributionFacets(distribution, t, 'month')[0];
    if (facet.kind !== 'snapshot') throw new Error('expected snapshot');
    const colors = facet.bars.map((b) => b.color);
    expect(colors).toHaveLength(labels.length + 1);
    expect(new Set(colors).size).toBe(colors.length);
    expect(colors.every((c) => SYNTHESIS_COLORS.includes(c))).toBe(true);
  });

  it('shares one color between the same label on both sides', () => {
    const point = [{ period: '2026-01-01', value: m(10) }];
    const distribution: ReportDistribution = {
      hidden: false,
      dataGrouping: 'third_party',
      series: [
        {
          currency: 'USD',
          debit: [{ label: 'Acme', points: point }],
          credit: [{ label: 'Acme', points: point }],
        },
      ],
    };
    const facet = toDistributionFacets(distribution, t, 'month')[0];
    if (facet.kind !== 'snapshot') throw new Error('expected snapshot');
    expect(facet.bars.map((b) => b.color)).toEqual([SYNTHESIS_COLORS[0], SYNTHESIS_COLORS[0]]);
  });
});

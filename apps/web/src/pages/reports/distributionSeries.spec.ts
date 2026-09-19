import { describe, expect, it } from 'vitest';
import { colorForLabel } from '../../components/chartColors';
import { toDistributionFacets } from './distributionSeries';
import type { ReportDistribution } from './reports.types';

const t = (key: string) => key;
const OTHER_COLOR = 'rgba(242, 239, 233, 0.35)';

describe('toDistributionFacets', () => {
  it('merges debit and credit into one snapshot facet per currency, debit negated', () => {
    const distribution: ReportDistribution = {
      hidden: false,
      series: [
        {
          currency: 'USD',
          debit: [{ label: 'Food', points: [{ period: '2026-01-01', value: 100 }] }],
          credit: [{ label: 'Salary', points: [{ period: '2026-01-01', value: 500 }] }],
        },
      ],
    };
    expect(toDistributionFacets(distribution, t)).toEqual([
      {
        kind: 'snapshot',
        title: 'USD',
        currency: 'USD',
        bars: [
          { label: 'Salary', value: 500, color: colorForLabel('Salary') },
          { label: 'Food', value: -100, color: colorForLabel('Food') },
        ],
      },
    ]);
  });

  it('orders the merged bars by magnitude regardless of side', () => {
    const distribution: ReportDistribution = {
      hidden: false,
      series: [
        {
          currency: 'USD',
          debit: [
            { label: 'Rent', points: [{ period: '2026-01-01', value: 1000 }] },
            { label: 'Coffee', points: [{ period: '2026-01-01', value: 5 }] },
          ],
          credit: [{ label: 'Salary', points: [{ period: '2026-01-01', value: 500 }] }],
        },
      ],
    };
    const facet = toDistributionFacets(distribution, t)[0];
    expect(facet).toMatchObject({ kind: 'snapshot' });
    if (facet.kind !== 'snapshot') throw new Error('expected snapshot');
    expect(facet.bars.map((b) => b.label)).toEqual(['Rent', 'Salary', 'Coffee']);
    expect(facet.bars.map((b) => b.value)).toEqual([-1000, 500, -5]);
  });

  it('translates a null label into "Other" with a muted, palette-independent color', () => {
    const distribution: ReportDistribution = {
      hidden: false,
      series: [
        {
          currency: 'USD',
          debit: [
            { label: 'Food', points: [{ period: '2026-01-01', value: 100 }] },
            { label: null, points: [{ period: '2026-01-01', value: 10 }] },
          ],
          credit: [],
        },
      ],
    };
    expect(toDistributionFacets(distribution, t)).toEqual([
      {
        kind: 'snapshot',
        title: 'USD',
        currency: 'USD',
        bars: [
          { label: 'Food', value: -100, color: colorForLabel('Food') },
          { label: 'reports.other', value: -10, color: OTHER_COLOR },
        ],
      },
    ]);
  });

  it('returns a temporal facet (multiple points per label) with debit series negated', () => {
    const distribution: ReportDistribution = {
      hidden: false,
      series: [
        {
          currency: 'USD',
          debit: [
            {
              label: 'Food',
              points: [
                { period: '2026-01-01', value: 100 },
                { period: '2026-02-01', value: 0 },
              ],
            },
          ],
          credit: [
            {
              label: 'Salary',
              points: [
                { period: '2026-01-01', value: 500 },
                { period: '2026-02-01', value: 500 },
              ],
            },
          ],
        },
      ],
    };
    expect(toDistributionFacets(distribution, t)).toEqual([
      {
        kind: 'temporal',
        title: 'USD',
        currency: 'USD',
        series: [
          {
            label: 'Salary',
            color: colorForLabel('Salary'),
            points: [
              { period: '2026-01-01', value: 500 },
              { period: '2026-02-01', value: 500 },
            ],
          },
          {
            label: 'Food',
            color: colorForLabel('Food'),
            points: [
              { period: '2026-01-01', value: -100 },
              { period: '2026-02-01', value: 0 },
            ],
          },
        ],
      },
    ]);
  });

  it('omits a currency with neither debit nor credit data', () => {
    const distribution: ReportDistribution = {
      hidden: false,
      series: [{ currency: 'USD', debit: [], credit: [] }],
    };
    expect(toDistributionFacets(distribution, t)).toEqual([]);
  });

  it('returns an empty list for a distribution with no series', () => {
    expect(toDistributionFacets({ hidden: false, series: [] }, t)).toEqual([]);
  });

  it('gives each label its own color, so two categories stay distinguishable', () => {
    const foodColor = colorForLabel('Food');
    const transportColor = colorForLabel('Transport');
    expect(foodColor).not.toBe(transportColor);
  });
});

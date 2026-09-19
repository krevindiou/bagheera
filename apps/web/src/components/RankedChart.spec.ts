import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { Bar } from 'vue-chartjs';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';
import RankedChart, { type RankedChartFacet } from './RankedChart.vue';

describe('RankedChart', () => {
  it('renders nothing when every facet is empty', () => {
    const wrapper = mount(RankedChart, {
      ...withGlobalPlugins(),
      props: { facets: [{ kind: 'snapshot', title: 'USD Debit', currency: 'USD', bars: [] }] },
    });
    expect(wrapper.find('.ranked-chart').exists()).toBe(false);
  });

  describe('snapshot facets (single-period ranking)', () => {
    const facets: RankedChartFacet[] = [
      {
        kind: 'snapshot',
        title: 'USD Debit',
        currency: 'USD',
        bars: [
          { label: 'Food', value: 100, color: '#b17834' },
          { label: 'Other', value: 10, color: 'rgba(0,0,0,0.35)' },
        ],
      },
    ];

    it('renders a horizontal bar chart with one bar per bucket', () => {
      const wrapper = mount(RankedChart, { ...withGlobalPlugins(), props: { facets } });
      expect(wrapper.find('.ranked-chart').exists()).toBe(true);
      expect(wrapper.text()).toContain('USD Debit');
      expect(wrapper.find('[data-testid="ranked-snapshot-chart"]').exists()).toBe(true);

      const chart = wrapper.findComponent(Bar);
      expect(chart.props('data')).toMatchObject({
        labels: ['Food', 'Other'],
        datasets: [{ data: [100, 10], backgroundColor: ['#b17834', 'rgba(0,0,0,0.35)'] }],
      });
      expect(chart.props('options')).toMatchObject({ indexAxis: 'y' });
    });

    it('sizes the chart taller for more bars', () => {
      const short = mount(RankedChart, {
        ...withGlobalPlugins(),
        props: { facets },
      });
      const many: RankedChartFacet[] = [
        {
          kind: 'snapshot',
          title: 'USD Debit',
          currency: 'USD',
          bars: Array.from({ length: 10 }, (_, i) => ({
            label: `Label ${i}`,
            value: 10,
            color: '#b17834',
          })),
        },
      ];
      const tall = mount(RankedChart, { ...withGlobalPlugins(), props: { facets: many } });

      const shortHeight = Number(
        short
          .find('[data-testid="ranked-snapshot-chart"]')
          .attributes('style')
          ?.match(/(\d+)px/)?.[1],
      );
      const tallHeight = Number(
        tall
          .find('[data-testid="ranked-snapshot-chart"]')
          .attributes('style')
          ?.match(/(\d+)px/)?.[1],
      );
      expect(tallHeight).toBeGreaterThan(shortHeight);
    });

    it("doesn't render a stacked chart for a snapshot facet", () => {
      const wrapper = mount(RankedChart, { ...withGlobalPlugins(), props: { facets } });
      expect(wrapper.find('[data-testid="ranked-stacked-chart"]').exists()).toBe(false);
    });

    it('emphasizes the zero gridline on the value (x) axis, separating credit from debit', () => {
      const wrapper = mount(RankedChart, { ...withGlobalPlugins(), props: { facets } });
      const options = wrapper.findComponent(Bar).props('options');
      const grid = options?.scales?.x?.grid as {
        color: (ctx: { tick: { value: number } }) => string;
        lineWidth: (ctx: { tick: { value: number } }) => number;
      };
      expect(grid.color({ tick: { value: 0 } })).not.toBe(grid.color({ tick: { value: 5 } }));
      expect(grid.lineWidth({ tick: { value: 0 } })).toBeGreaterThan(
        grid.lineWidth({ tick: { value: 5 } }),
      );
    });
  });

  describe('temporal facets (multi-period ranking)', () => {
    const facets: RankedChartFacet[] = [
      {
        kind: 'temporal',
        title: 'USD Debit',
        currency: 'USD',
        series: [
          {
            label: 'Food',
            color: '#b17834',
            points: [
              { period: '2026-01-01', value: 100 },
              { period: '2026-02-01', value: 80 },
            ],
          },
          {
            label: 'Other',
            color: 'rgba(0,0,0,0.35)',
            points: [
              { period: '2026-01-01', value: 10 },
              { period: '2026-02-01', value: 20 },
            ],
          },
        ],
      },
    ];

    it('renders a stacked bar chart with one dataset per label, sharing one stack', () => {
      const wrapper = mount(RankedChart, { ...withGlobalPlugins(), props: { facets } });
      expect(wrapper.find('[data-testid="ranked-stacked-chart"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="ranked-snapshot-chart"]').exists()).toBe(false);

      const chart = wrapper.findComponent(Bar);
      expect(chart.props('data')).toMatchObject({
        labels: ['2026-1', '2026-2'],
        datasets: [
          { label: 'Food', data: [100, 80], backgroundColor: '#b17834', stack: 'ranked' },
          {
            label: 'Other',
            data: [10, 20],
            backgroundColor: 'rgba(0,0,0,0.35)',
            stack: 'ranked',
          },
        ],
      });
    });

    it('stacks both axes', () => {
      const wrapper = mount(RankedChart, { ...withGlobalPlugins(), props: { facets } });
      const chart = wrapper.findComponent(Bar);
      expect(chart.props('options')).toMatchObject({
        scales: { x: { stacked: true }, y: { stacked: true } },
      });
    });

    it('emphasizes the zero gridline on the value (y) axis, separating credit from debit', () => {
      const wrapper = mount(RankedChart, { ...withGlobalPlugins(), props: { facets } });
      const options = wrapper.findComponent(Bar).props('options');
      const grid = options?.scales?.y?.grid as {
        color: (ctx: { tick: { value: number } }) => string;
        lineWidth: (ctx: { tick: { value: number } }) => number;
      };
      expect(grid.color({ tick: { value: 0 } })).not.toBe(grid.color({ tick: { value: 5 } }));
      expect(grid.lineWidth({ tick: { value: 0 } })).toBeGreaterThan(
        grid.lineWidth({ tick: { value: 5 } }),
      );
    });
  });

  it('renders one section per facet', () => {
    const wrapper = mount(RankedChart, {
      ...withGlobalPlugins(),
      props: {
        facets: [
          {
            kind: 'snapshot',
            title: 'USD Debit',
            currency: 'USD',
            bars: [{ label: 'Food', value: 100, color: '#b17834' }],
          },
          {
            kind: 'snapshot',
            title: 'USD Credit',
            currency: 'USD',
            bars: [{ label: 'Salary', value: 500, color: '#0077bd' }],
          },
        ] satisfies RankedChartFacet[],
      },
    });
    expect(wrapper.findAll('.ranked-chart-facet')).toHaveLength(2);
  });
});

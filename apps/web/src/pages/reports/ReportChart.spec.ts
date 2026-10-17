import { toMinorUnits as m } from '@bagheera/money';
import type { PeriodGrouping } from '@bagheera/reference-data';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import RankedChart from '../../components/RankedChart.vue';
import SynthesisChart from '../../components/SynthesisChart.vue';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';
import ReportChart from './ReportChart.vue';
import type { ReportChartData } from './reports.types';

const series: ReportChartData = {
  kind: 'series',
  series: {
    hidden: false,
    axisBounds: { min: 0, max: m(10) },
    series: [
      {
        currency: 'USD',
        debit: [{ period: '2026-01', value: m(10) }],
        credit: [{ period: '2026-01', value: m(5) }],
      },
    ],
  },
};

const distribution: ReportChartData = {
  kind: 'distribution',
  distribution: {
    hidden: false,
    dataGrouping: 'category',
    series: [
      {
        currency: 'USD',
        debit: [{ label: 'Food', points: [{ period: '2026-01', value: m(100) }] }],
        credit: [],
      },
    ],
  },
};

function mountChart(
  report: ReportChartData | null,
  error = false,
  title?: string,
  periodGrouping: PeriodGrouping = 'month',
) {
  return mount(ReportChart, {
    ...withGlobalPlugins(),
    props: { report, error, title, periodGrouping },
  });
}

describe('ReportChart', () => {
  it('draws a series report as debit and credit lines per currency', () => {
    const wrapper = mountChart(series);

    expect(wrapper.findComponent(RankedChart).exists()).toBe(false);
    const chart = wrapper.getComponent(SynthesisChart);
    expect(chart.props('series')).toMatchObject([
      { label: 'USD Debit', dash: [8, 4], points: [{ period: '2026-01', value: 10 }] },
      { label: 'USD Credit', points: [{ period: '2026-01', value: 5 }] },
    ]);
    expect(chart.props('axisBounds')).toEqual({ min: 0, max: 10 });
  });

  it('hands the report period grouping to the series chart', () => {
    const chart = mountChart(series, false, undefined, 'quarter').getComponent(SynthesisChart);
    expect(chart.props('periodGrouping')).toBe('quarter');
  });

  it('hands the report period grouping to the distribution facets', () => {
    const multiPeriod: ReportChartData = {
      kind: 'distribution',
      distribution: {
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
      },
    };
    const wrapper = mountChart(multiPeriod, false, undefined, 'year');
    expect(wrapper.getComponent(RankedChart).props('facets')).toMatchObject([
      { kind: 'temporal', periodGrouping: 'year' },
    ]);
  });

  it("names the series chart for assistive tech with the report's title and its currencies", () => {
    const withoutTitle = mountChart(series).getComponent(SynthesisChart);
    expect(withoutTitle.props('label')).toBe('USD');

    const withTitle = mountChart(series, false, 'Monthly spend').getComponent(SynthesisChart);
    expect(withTitle.props('label')).toBe('Monthly spend (USD)');
  });

  it('draws a distribution report as a ranked chart', () => {
    const wrapper = mountChart(distribution);

    expect(wrapper.findComponent(SynthesisChart).exists()).toBe(false);
    expect(wrapper.getComponent(RankedChart).props('facets')).toMatchObject([
      { kind: 'snapshot', bars: [{ label: 'Food', value: -100 }] },
    ]);
  });

  it('passes its title down to the ranked chart, for its per-facet aria-label', () => {
    const wrapper = mountChart(distribution, false, 'Spending by category');
    expect(wrapper.getComponent(RankedChart).props('reportTitle')).toBe('Spending by category');
  });

  it('shows a loading status while the query behind the report has not resolved yet', () => {
    const wrapper = mountChart(null);

    expect(wrapper.find('[role="status"]').text()).toBe('Loading…');
    expect(wrapper.findComponent(SynthesisChart).exists()).toBe(false);
    expect(wrapper.findComponent(RankedChart).exists()).toBe(false);
  });

  it('shows a load error instead of a chart when the query failed', () => {
    const wrapper = mountChart(null, true);

    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });

  it('shows a no-data message for a hidden series report instead of an empty chart', () => {
    const wrapper = mountChart({
      kind: 'series',
      series: { hidden: true, axisBounds: null, series: [] },
    });

    expect(wrapper.findComponent(SynthesisChart).exists()).toBe(false);
    expect(wrapper.find('[data-testid="report-chart-empty"]').text()).toBe(
      'No operations match this report yet.',
    );
  });

  it('shows a no-data message for a hidden distribution report instead of an empty chart', () => {
    const wrapper = mountChart({
      kind: 'distribution',
      distribution: { hidden: true, dataGrouping: 'category', series: [] },
    });

    expect(wrapper.findComponent(RankedChart).exists()).toBe(false);
    expect(wrapper.find('[data-testid="report-chart-empty"]').text()).toBe(
      'No operations match this report yet.',
    );
  });

  it('switches chart when the report kind changes', async () => {
    const wrapper = mountChart(series);

    await wrapper.setProps({ report: distribution });

    expect(wrapper.findComponent(SynthesisChart).exists()).toBe(false);
    expect(wrapper.findComponent(RankedChart).exists()).toBe(true);
  });
});

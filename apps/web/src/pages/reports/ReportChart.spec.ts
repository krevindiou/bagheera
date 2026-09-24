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
    axisBounds: { min: 0, max: 10 },
    series: [
      {
        currency: 'USD',
        debit: [{ period: '2026-01', value: 10 }],
        credit: [{ period: '2026-01', value: 5 }],
      },
    ],
  },
};

const distribution: ReportChartData = {
  kind: 'distribution',
  distribution: {
    hidden: false,
    series: [
      {
        currency: 'USD',
        debit: [{ label: 'Food', points: [{ period: '2026-01', value: 100 }] }],
        credit: [],
      },
    ],
  },
};

function mountChart(report: ReportChartData | null) {
  return mount(ReportChart, { ...withGlobalPlugins(), props: { report } });
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

  it('draws a distribution report as a ranked chart', () => {
    const wrapper = mountChart(distribution);

    expect(wrapper.findComponent(SynthesisChart).exists()).toBe(false);
    expect(wrapper.getComponent(RankedChart).props('facets')).toMatchObject([
      { kind: 'snapshot', bars: [{ label: 'Food', value: -100 }] },
    ]);
  });

  it('draws nothing while there is no report yet', () => {
    const wrapper = mountChart(null);

    expect(wrapper.findComponent(SynthesisChart).exists()).toBe(false);
    expect(wrapper.findComponent(RankedChart).exists()).toBe(false);
  });

  it('gives a hidden series report an empty chart with no axis bounds', () => {
    const wrapper = mountChart({
      kind: 'series',
      series: { hidden: true, axisBounds: null, series: [] },
    });
    const chart = wrapper.getComponent(SynthesisChart);

    expect(chart.props('series')).toEqual([]);
    expect(chart.props('axisBounds')).toBeNull();
    expect(wrapper.find('.synthesis-chart').exists()).toBe(false);
  });

  it('gives a hidden distribution report an empty ranked chart', () => {
    const wrapper = mountChart({
      kind: 'distribution',
      distribution: { hidden: true, series: [] },
    });

    expect(wrapper.getComponent(RankedChart).props('facets')).toEqual([]);
  });

  it('switches chart when the report kind changes', async () => {
    const wrapper = mountChart(series);

    await wrapper.setProps({ report: distribution });

    expect(wrapper.findComponent(SynthesisChart).exists()).toBe(false);
    expect(wrapper.findComponent(RankedChart).exists()).toBe(true);
  });
});

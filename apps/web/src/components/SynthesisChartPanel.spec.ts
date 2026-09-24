import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';
import SynthesisChart, { type SynthesisChartSeries } from './SynthesisChart.vue';
import SynthesisChartPanel from './SynthesisChartPanel.vue';
import type { SynthesisChartRange } from './synthesisChartRange';

const series: SynthesisChartSeries[] = [
  { label: 'USD', color: '#123456', points: [{ period: '2026-01', value: 10 }] },
];

function mountPanel(props: { title?: string; range?: SynthesisChartRange } = {}) {
  return mount(SynthesisChartPanel, {
    ...withGlobalPlugins(),
    props: {
      series,
      axisBounds: { min: 0, max: 10 },
      rangeTestid: 'range',
      range: '12',
      ...props,
    },
    attrs: { 'data-testid': 'panel' },
  });
}

describe('SynthesisChartPanel', () => {
  it('draws the chart with its series and axis bounds', () => {
    const chart = mountPanel().getComponent(SynthesisChart);

    expect(chart.props('series')).toEqual(series);
    expect(chart.props('axisBounds')).toEqual({ min: 0, max: 10 });
  });

  it('shows the title when given, and none otherwise', () => {
    expect(mountPanel({ title: 'Synthesis' }).get('h2').text()).toBe('Synthesis');
    expect(mountPanel().find('h2').exists()).toBe(false);
  });

  it('offers every range under the given test id, with the current one selected', () => {
    const select = mountPanel({ range: '24' }).get('[data-testid="range"]');

    expect(select.attributes('aria-label')).toBe('Range');
    expect(select.findAll('option').map((o) => o.text())).toEqual([
      '12 months',
      '24 months',
      'All time',
    ]);
    expect((select.element as HTMLSelectElement).value).toBe('24');
  });

  it('emits update:range when another range is picked', async () => {
    const wrapper = mountPanel();

    await wrapper.get('[data-testid="range"]').setValue('all');

    expect(wrapper.emitted('update:range')).toEqual([['all']]);
  });

  it('forwards attributes to the root panel', () => {
    const wrapper = mountPanel();

    expect(wrapper.attributes('data-testid')).toBe('panel');
    expect(wrapper.classes()).toContain('panel');
  });
});

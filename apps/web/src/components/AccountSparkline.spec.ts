import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AccountSparkline from './AccountSparkline.vue';

describe('AccountSparkline', () => {
  it('renders nothing with fewer than two points', () => {
    expect(
      mount(AccountSparkline, { props: { values: [] } })
        .find('svg')
        .exists(),
    ).toBe(false);
    expect(
      mount(AccountSparkline, { props: { values: [100] } })
        .find('svg')
        .exists(),
    ).toBe(false);
  });

  // `values` is optional/defaulted, guarding against a stale or
  // mid-refetch API response — see AccountSparkline.vue.
  it('renders nothing when values is omitted entirely', () => {
    expect(mount(AccountSparkline, { props: {} }).find('svg').exists()).toBe(false);
  });

  it('draws a line and fill path through every value, oldest first', () => {
    const wrapper = mount(AccountSparkline, { props: { values: [100, 200, 150] } });
    const paths = wrapper.findAll('path');
    expect(paths).toHaveLength(2);
    // Ascending value (100) is lowest on screen (largest y), the peak
    // (200) is highest (smallest y, here the padding value 3).
    expect(paths[1].attributes('d')).toBe('M0.00,25.00 L50.00,3.00 L100.00,14.00');
    // The area path closes the same line down to the baseline.
    expect(paths[0].attributes('d')).toBe(
      'M0.00,25.00 L50.00,3.00 L100.00,14.00 L100.00,28 L0.00,28 Z',
    );
  });

  it('draws a flat mid-line when every value is equal', () => {
    const wrapper = mount(AccountSparkline, { props: { values: [50, 50, 50] } });
    expect(wrapper.find('path[fill="none"]').attributes('d')).toBe(
      'M0.00,14.00 L50.00,14.00 L100.00,14.00',
    );
  });

  it('uses the given color for both the line and its fill', () => {
    const wrapper = mount(AccountSparkline, {
      props: { values: [100, 200], color: '#5fd98d' },
    });
    const paths = wrapper.findAll('path');
    expect(paths[0].attributes('fill')).toBe('#5fd98d');
    expect(paths[1].attributes('stroke')).toBe('#5fd98d');
  });

  it('defaults to the theme violet when no color is given', () => {
    const wrapper = mount(AccountSparkline, { props: { values: [100, 200] } });
    expect(wrapper.find('path[fill="none"]').attributes('stroke')).toBe('var(--violet-bright)');
  });
});

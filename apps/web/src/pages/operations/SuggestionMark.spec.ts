import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import SuggestionMark from './SuggestionMark.vue';

describe('SuggestionMark', () => {
  it('keeps the words for the tooltip and for screen readers, and shows an icon', () => {
    const wrapper = mount(SuggestionMark, { props: { label: 'Suggested from history' } });

    expect(wrapper.attributes('title')).toBe('Suggested from history');
    expect(wrapper.find('.visually-hidden').text()).toBe('Suggested from history');
    expect(wrapper.find('svg').exists()).toBe(true);
  });
});

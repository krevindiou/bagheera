import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';
import LocaleOptions from './LocaleOptions.vue';

function mountOptions(current: 'en' | 'fr' = 'en') {
  return mount(LocaleOptions, { ...withGlobalPlugins(), props: { current } });
}

describe('LocaleOptions', () => {
  it('renders a labelled listbox with every supported locale by its own name', () => {
    const wrapper = mountOptions();

    expect(wrapper.get('[role="listbox"]').attributes('aria-label')).toBe('Language');
    expect(wrapper.findAll('[role="option"]').map((o) => o.text().trim())).toEqual([
      'English',
      'Français',
    ]);
  });

  it('marks only the current locale as selected and checked', () => {
    const options = mountOptions('fr').findAll('[role="option"]');

    expect(options[0]?.attributes('aria-selected')).toBe('false');
    expect(options[0]?.find('.menu-check').exists()).toBe(false);
    expect(options[1]?.attributes('aria-selected')).toBe('true');
    expect(options[1]?.classes()).toContain('selected');
    expect(options[1]?.find('.menu-check').exists()).toBe(true);
  });

  it('emits pick with the chosen locale code', async () => {
    const wrapper = mountOptions();

    await wrapper.findAll('[role="option"]')[1]?.trigger('click');

    expect(wrapper.emitted('pick')).toEqual([['fr']]);
  });
});

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';
import LoadError from './LoadError.vue';

describe('LoadError', () => {
  it('renders the load-error message as an alert', () => {
    const wrapper = mount(LoadError, withGlobalPlugins());

    expect(wrapper.attributes('role')).toBe('alert');
    expect(wrapper.classes()).toContain('alert-danger');
    expect(wrapper.text()).toBe("Couldn't load this. Please try again.");
  });

  it('forwards attributes to the root', () => {
    const wrapper = mount(LoadError, {
      ...withGlobalPlugins(),
      attrs: { 'data-testid': 'x-error', class: 'mb-3' },
    });

    expect(wrapper.attributes('data-testid')).toBe('x-error');
    expect(wrapper.classes()).toContain('mb-3');
  });
});

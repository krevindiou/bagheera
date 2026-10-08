import { describe, expect, it } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import { withGlobalPlugins } from './test-support/withGlobalPlugins';
import App from './App.vue';
import BaseLayout from './layouts/BaseLayout.vue';

// App.vue only wires up BaseLayout (own spec): shallow-mounted.
describe('App', () => {
  it('renders BaseLayout', () => {
    const wrapper = shallowMount(App, withGlobalPlugins());
    expect(wrapper.findComponent(BaseLayout).exists()).toBe(true);
  });
});

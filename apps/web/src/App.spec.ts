import { describe, expect, it } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import { withGlobalPlugins } from './test-support/withGlobalPlugins';
import App from './App.vue';
import BaseLayout from './layouts/BaseLayout.vue';

// App.vue has no logic of its own — just wires up BaseLayout, which has its
// own full spec (src/layouts/BaseLayout.spec.ts). Shallow-mount so this test
// doesn't re-exercise BaseLayout's internals (queries, router, session).
describe('App', () => {
  it('renders BaseLayout', () => {
    const wrapper = shallowMount(App, withGlobalPlugins());
    expect(wrapper.findComponent(BaseLayout).exists()).toBe(true);
  });
});

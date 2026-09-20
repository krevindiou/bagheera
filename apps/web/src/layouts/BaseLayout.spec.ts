import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { asMockedApiClient, mockApiClient } from '../test-support/mockApiClient';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';

vi.mock('../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../api/client';
import { useSessionStore } from '../stores/session.store';
import BaseLayout from './BaseLayout.vue';

const apiClient = asMockedApiClient(realApiClient);

// A dedicated, minimal router instead of the app's real singleton: BaseLayout
// only cares that these names resolve and that push() works, not about what
// `<router-view>` actually renders — using the real route table would drag
// real (heavy) page components into every test here.
function createTestRouter(): Router {
  const stub = { template: '<div />' };
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/sign-in', name: 'sign-in', component: stub },
      { path: '/home', name: 'home', component: stub },
      { path: '/accounts', name: 'accounts', component: stub },
      { path: '/accounts/:accountId/operations', name: 'operations', component: stub },
      { path: '/accounts/:accountId/schedulers', name: 'schedulers', component: stub },
      { path: '/reports', name: 'reports', component: stub },
      { path: '/settings/profile', name: 'settings-profile', component: stub },
      { path: '/settings/passkeys', name: 'settings-passkeys', component: stub },
    ],
  });
}

let wrapper: VueWrapper | undefined;
let router: Router;

describe('BaseLayout', () => {
  beforeEach(async () => {
    router = createTestRouter();
    // A freshly created memory-history router starts unresolved (no match
    // for its default "" location) until it's actually navigated once.
    await router.push({ name: 'home' });
    apiClient.GET.mockReset();
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('shows no sidebar while signed out, and fetches nothing', () => {
    wrapper = mount(BaseLayout, withGlobalPlugins(router));
    expect(wrapper.find('.app-shell').exists()).toBe(false);
    expect(apiClient.GET).not.toHaveBeenCalled();
  });

  it('shows the sidebar once authenticated, with the brand and 4 nav items', async () => {
    wrapper = mount(BaseLayout, withGlobalPlugins(router));
    useSessionStore().setMember({ email: 'member@example.com', locale: 'en' });
    await wrapper.vm.$nextTick();

    // Includes the "B" logo-mark glyph alongside the "Bagheera" wordmark.
    expect(wrapper.find('.side-brand').text()).toContain('Bagheera');
    const labels = wrapper.findAll('.side-nav-item').map((el) => el.text());
    expect(labels).toEqual(['Dashboard', 'Accounts', 'Reports', 'Settings']);
    expect(wrapper.find('.side-foot-name').text()).toBe('member@example.com');
    expect(wrapper.find('.avatar-chip').text()).toBe('ME');
  });

  it.each([
    ['home', 'Dashboard', {}],
    ['accounts', 'Accounts', {}],
    ['operations', 'Accounts', { accountId: 'a1' }],
    ['schedulers', 'Accounts', { accountId: 'a1' }],
    ['reports', 'Reports', {}],
    ['settings-profile', 'Settings', {}],
    ['settings-passkeys', 'Settings', {}],
  ])(
    'marks the right nav item active on the %s route',
    async (routeName, expectedActive, params) => {
      // Only operations/schedulers actually declare an :accountId param —
      // passing it for the rest would trip Vue Router's dev-mode
      // "Discarded invalid param(s)" warning for no reason.
      await router.push({ name: routeName, params });
      wrapper = mount(BaseLayout, withGlobalPlugins(router));
      useSessionStore().setMember({ email: 'member@example.com', locale: 'en' });
      await wrapper.vm.$nextTick();

      const active = wrapper.findAll('.side-nav-item.active').map((el) => el.text());
      expect(active).toEqual([expectedActive]);
    },
  );

  it('signs out: calls the API, clears the session, and returns to sign-in', async () => {
    wrapper = mount(BaseLayout, withGlobalPlugins(router));
    useSessionStore().setMember({ email: 'member@example.com', locale: 'en' });
    await wrapper.vm.$nextTick();

    await wrapper.find('.side-foot-logout').trigger('click');
    // signOut() doesn't await its own router.push(...), so the click
    // handler's promise settles once navigation has merely started — poll
    // the route itself rather than assume it's finished by then.
    await vi.waitFor(() => {
      if (router.currentRoute.value.name !== 'sign-in') throw new Error('not navigated yet');
    });

    expect(apiClient.POST).toHaveBeenCalledWith('/auth/sign-out');
    expect(useSessionStore().isAuthenticated).toBe(false);
  });
});

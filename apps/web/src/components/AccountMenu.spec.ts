import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { asMockedApiClient, mockApiClient } from '../test-support/mockApiClient';

vi.mock('../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../api/client';
import { i18n } from '../i18n';
import { router } from '../router';
import { useSessionStore } from '../stores/session.store';
import { withGlobalPlugins } from '../test-support/withGlobalPlugins';
import AccountMenu from './AccountMenu.vue';

// Polls, like waitForRouteName: the replace() goes through an async guard.
async function waitForLocale(locale: string): Promise<void> {
  await vi.waitFor(() => {
    if (router.currentRoute.value.params.locale !== locale) {
      throw new Error(`still waiting for locale "${locale}"`);
    }
  });
}

const apiClient = asMockedApiClient(realApiClient);

function jsonResult(status: number, data?: unknown) {
  return { data, error: undefined, response: new Response(null, { status }) };
}

describe('AccountMenu', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    localStorage.clear();
    apiClient.POST.mockReset();
    await router.push({ name: 'sign-in', params: { locale: 'en' } });
  });

  it('shows the email-initials avatar and email on the trigger, starting closed', async () => {
    const wrapper = mount(AccountMenu, withGlobalPlugins());
    // After mount(): withGlobalPlugins() activates its own Pinia.
    useSessionStore().setMember({ email: 'john@example.net', locale: 'en', timeZone: 'UTC' });
    await wrapper.vm.$nextTick();

    expect(wrapper.get('.account-avatar').text()).toBe('JO');
    expect(wrapper.get('.account-email').text()).toBe('john@example.net');
    expect(wrapper.find('.account-panel').exists()).toBe(false);
  });

  it('opens to show every supported locale and Logout, closes on a second click', async () => {
    const wrapper = mount(AccountMenu, withGlobalPlugins());
    useSessionStore().setMember({ email: 'john@example.net', locale: 'en', timeZone: 'UTC' });
    const trigger = wrapper.get('.account-trigger');

    await trigger.trigger('click');
    expect(trigger.attributes('aria-expanded')).toBe('true');
    expect(wrapper.findAll('.menu-option').map((o) => o.text().trim())).toEqual([
      'English',
      'Français',
    ]);
    expect(wrapper.get('.account-logout').text()).toContain('Logout');

    // The language options sit in a labelled listbox, so `role="option"`
    // has the parent ARIA requires.
    const listbox = wrapper.get('[role="listbox"]');
    expect(listbox.attributes('aria-label')).toBe('Language');
    expect(listbox.findAll('[role="option"]')).toHaveLength(2);

    await trigger.trigger('click');
    expect(trigger.attributes('aria-expanded')).toBe('false');
    expect(wrapper.find('.account-panel').exists()).toBe(false);
  });

  it('switches locale, persists it server-side, and closes the menu', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mount(AccountMenu, withGlobalPlugins());
    useSessionStore().setMember({ email: 'john@example.net', locale: 'en', timeZone: 'UTC' });
    await wrapper.vm.$nextTick();

    await wrapper.get('.account-trigger').trigger('click');
    await wrapper.findAll('.menu-option')[1]?.trigger('click');
    await waitForLocale('fr');

    expect(i18n.global.locale.value).toBe('fr');
    expect(apiClient.POST).toHaveBeenCalledWith('/members/locale', { body: { locale: 'fr' } });
    expect(useSessionStore().member?.locale).toBe('fr');
    expect(wrapper.find('.account-panel').exists()).toBe(false);
  });

  it('signs out: calls the API, clears the session, and returns to sign-in', async () => {
    const wrapper = mount(AccountMenu, withGlobalPlugins());
    useSessionStore().setMember({ email: 'john@example.net', locale: 'en', timeZone: 'UTC' });
    await wrapper.vm.$nextTick();

    await wrapper.get('.account-trigger').trigger('click');
    await wrapper.get('.account-logout').trigger('click');

    // Polls: signOut() doesn't await its navigation.
    await vi.waitFor(() => {
      if (router.currentRoute.value.name !== 'sign-in') throw new Error('not navigated yet');
    });

    expect(apiClient.POST).toHaveBeenCalledWith('/auth/sign-out');
    expect(useSessionStore().isAuthenticated).toBe(false);
  });

  it('closes on Escape', async () => {
    const wrapper = mount(AccountMenu, withGlobalPlugins());
    await wrapper.get('.account-trigger').trigger('click');
    expect(wrapper.find('.account-panel').exists()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.account-panel').exists()).toBe(false);
  });

  it('closes when clicking outside', async () => {
    const wrapper = mount(AccountMenu, withGlobalPlugins());
    await wrapper.get('.account-trigger').trigger('click');
    expect(wrapper.find('.account-panel').exists()).toBe(true);

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.account-panel').exists()).toBe(false);
  });
});

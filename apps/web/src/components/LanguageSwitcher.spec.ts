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
import LanguageSwitcher from './LanguageSwitcher.vue';

// Mirrors waitForRouteName's own rationale: choose()'s router.replace()
// resolves through the router's async guard, which flushPromises() alone
// doesn't reliably observe — poll for the param it eventually sets instead.
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

describe('LanguageSwitcher', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    localStorage.clear();
    apiClient.POST.mockReset();
    await router.push({ name: 'sign-in', params: { locale: 'en' } });
  });

  it('shows the active locale on the trigger and starts closed', () => {
    const wrapper = mount(LanguageSwitcher, withGlobalPlugins());
    expect(wrapper.get('.lang-trigger').text()).toBe('EN');
    expect(wrapper.find('.lang-list').exists()).toBe(false);
  });

  it('opens to list every supported locale, marking the active one', async () => {
    const wrapper = mount(LanguageSwitcher, withGlobalPlugins());
    await wrapper.get('.lang-trigger').trigger('click');

    const options = wrapper.findAll('.lang-option');
    expect(options.map((o) => o.text().trim())).toEqual(['English', 'Français']);
    expect(options[0]?.classes()).toContain('selected');
    expect(options[1]?.classes()).not.toContain('selected');
  });

  it('switches the URL locale, the i18n catalog, and persists the choice for a signed-out visitor', async () => {
    const wrapper = mount(LanguageSwitcher, withGlobalPlugins());
    await wrapper.get('.lang-trigger').trigger('click');
    await wrapper.findAll('.lang-option')[1]?.trigger('click');
    await waitForLocale('fr');

    expect(i18n.global.locale.value).toBe('fr');
    expect(localStorage.getItem('bagheera.locale')).toBe('fr');
    expect(apiClient.POST).not.toHaveBeenCalled();
    // Picking an option also closes the menu.
    expect(wrapper.find('.lang-list').exists()).toBe(false);
  });

  it('also persists the choice server-side when signed in', async () => {
    // withGlobalPlugins() mints its own fresh Pinia and activates it — the
    // store must be grabbed after mount(), or this resolves a different
    // (pre-mount) instance than the one actually injected into the
    // component tree.
    const wrapper = mount(LanguageSwitcher, withGlobalPlugins());
    const session = useSessionStore();
    session.setMember({ email: 'member@example.com', locale: 'en' });
    apiClient.POST.mockResolvedValueOnce(jsonResult(200));

    await wrapper.get('.lang-trigger').trigger('click');
    await wrapper.findAll('.lang-option')[1]?.trigger('click');
    await waitForLocale('fr');

    expect(apiClient.POST).toHaveBeenCalledWith('/members/locale', { body: { locale: 'fr' } });
    expect(session.member?.locale).toBe('fr');
  });

  it('does nothing when re-selecting the already-active locale', async () => {
    const wrapper = mount(LanguageSwitcher, withGlobalPlugins());
    await wrapper.get('.lang-trigger').trigger('click');
    await wrapper.findAll('.lang-option')[0]?.trigger('click');
    await wrapper.vm.$nextTick();

    expect(router.currentRoute.value.params.locale).toBe('en');
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const wrapper = mount(LanguageSwitcher, withGlobalPlugins());
    await wrapper.get('.lang-trigger').trigger('click');
    expect(wrapper.find('.lang-list').exists()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.lang-list').exists()).toBe(false);
  });

  it('closes when clicking outside', async () => {
    const wrapper = mount(LanguageSwitcher, withGlobalPlugins());
    await wrapper.get('.lang-trigger').trigger('click');
    expect(wrapper.find('.lang-list').exists()).toBe(true);

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.lang-list').exists()).toBe(false);
  });
});

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

  it('lists every supported locale and preselects the active one', () => {
    const wrapper = mount(LanguageSwitcher, withGlobalPlugins());
    const select = wrapper.get('select');
    expect(select.findAll('option').map((o) => o.text())).toEqual(['English', 'Français']);
    expect((select.element as HTMLSelectElement).value).toBe('en');
  });

  it('switches the URL locale, the i18n catalog, and persists the choice for a signed-out visitor', async () => {
    const wrapper = mount(LanguageSwitcher, withGlobalPlugins());
    await wrapper.get('select').setValue('fr');
    await waitForLocale('fr');

    expect(i18n.global.locale.value).toBe('fr');
    expect(localStorage.getItem('bagheera.locale')).toBe('fr');
    expect(apiClient.POST).not.toHaveBeenCalled();
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

    await wrapper.get('select').setValue('fr');
    await waitForLocale('fr');

    expect(apiClient.POST).toHaveBeenCalledWith('/members/locale', { body: { locale: 'fr' } });
    expect(session.member?.locale).toBe('fr');
  });

  it('does nothing when re-selecting the already-active locale', async () => {
    const wrapper = mount(LanguageSwitcher, withGlobalPlugins());
    await wrapper.get('select').setValue('en');
    await wrapper.vm.$nextTick();

    expect(router.currentRoute.value.params.locale).toBe('en');
    expect(apiClient.POST).not.toHaveBeenCalled();
  });
});

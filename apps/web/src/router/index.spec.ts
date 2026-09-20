import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asMockedApiClient, mockApiClient } from '../test-support/mockApiClient';

vi.mock('../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../api/client';
import { i18n } from '../i18n';
import { useSessionStore } from '../stores/session.store';
import { router } from './index';

const apiClient = asMockedApiClient(realApiClient);

describe('router auth guard', () => {
  beforeEach(async () => {
    apiClient.GET.mockReset();
    setActivePinia(createPinia());
    localStorage.clear();
    await router.push({ name: 'sign-in' });
  });

  it('lets navigation through to a route with no requiresAuth, without touching the session', async () => {
    await router.push({ name: 'register' });
    expect(router.currentRoute.value.name).toBe('register');
    expect(apiClient.GET).not.toHaveBeenCalled();
  });

  it('redirects to sign-in when no Pinia instance is active', async () => {
    setActivePinia(undefined);
    await router.push({ name: 'home' });
    expect(router.currentRoute.value.name).toBe('sign-in');
  });

  it('redirects to sign-in once restore() resolves with no active session', async () => {
    apiClient.GET.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 401 }),
    });
    await router.push({ name: 'home' });
    expect(router.currentRoute.value.name).toBe('sign-in');
  });

  it('allows navigation once restore() resolves with an authenticated member', async () => {
    apiClient.GET.mockResolvedValueOnce({
      data: { email: 'member@example.com', locale: 'en' },
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    await router.push({ name: 'home' });
    expect(router.currentRoute.value.name).toBe('home');
  });

  it('skips the restore round trip once the session is already restored', async () => {
    const store = useSessionStore();
    store.setMember({ email: 'member@example.com', locale: 'en' });
    store.restored = true;
    await router.push({ name: 'home' });
    expect(router.currentRoute.value.name).toBe('home');
    expect(apiClient.GET).not.toHaveBeenCalled();
  });
});

describe('router locale segment', () => {
  beforeEach(async () => {
    apiClient.GET.mockReset();
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('defaults every named push to the current route locale', async () => {
    await router.push({ name: 'sign-in', params: { locale: 'fr' } });
    await router.push({ name: 'register' });
    expect(router.currentRoute.value.params.locale).toBe('fr');
    expect(router.currentRoute.value.fullPath).toBe('/fr/register');
  });

  it('falls back to a detected locale for the very first push (no current route yet)', async () => {
    localStorage.setItem('bagheera.locale', 'fr');
    await router.push({ name: 'sign-in' });
    expect(router.currentRoute.value.params.locale).toBe('fr');
  });

  it('honors an explicitly-passed locale param over the current route', async () => {
    await router.push({ name: 'sign-in', params: { locale: 'en' } });
    await router.push({ name: 'sign-in', params: { locale: 'fr' } });
    expect(router.currentRoute.value.params.locale).toBe('fr');
  });

  it('redirects an unsupported locale segment to a detected one', async () => {
    await router.push('/de/sign-in');
    expect(router.currentRoute.value.name).toBe('sign-in');
    expect(router.currentRoute.value.params.locale).toBe('en');
  });

  it('loads and activates the route locale catalog', async () => {
    await router.push({ name: 'sign-in', params: { locale: 'fr' } });
    expect(i18n.global.locale.value).toBe('fr');
    expect(i18n.global.t('auth.signIn.submit')).toBe('Se connecter');

    await router.push({ name: 'sign-in', params: { locale: 'en' } });
    expect(i18n.global.locale.value).toBe('en');
  });

  it('keeps an authenticated redirect in the same locale it was denied in', async () => {
    apiClient.GET.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 401 }),
    });
    await router.push({ name: 'home', params: { locale: 'fr' } });
    expect(router.currentRoute.value.name).toBe('sign-in');
    expect(router.currentRoute.value.params.locale).toBe('fr');
  });
});

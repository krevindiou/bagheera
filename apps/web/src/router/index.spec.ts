import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asMockedApiClient, mockApiClient } from '../test-support/mockApiClient';

vi.mock('../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../api/client';
import { i18n } from '../i18n';
import { useSessionStore } from '../stores/session.store';
import { router } from './index';

const apiClient = asMockedApiClient(realApiClient);

const signedOut = () => ({
  data: undefined,
  error: undefined,
  response: new Response(null, { status: 401 }),
});
const signedIn = () => ({
  data: { email: 'member@example.com', locale: 'en', timeZone: 'UTC' },
  error: undefined,
  response: new Response(null, { status: 200 }),
});

// Starts each test signed out on sign-in, with a fresh, unrestored session.
async function resetToSignIn(): Promise<void> {
  setActivePinia(createPinia());
  useSessionStore().restored = true;
  await router.push({ name: 'sign-in' });
  setActivePinia(createPinia());
  apiClient.GET.mockReset();
}

describe('router auth guard', () => {
  beforeEach(async () => {
    localStorage.clear();
    await resetToSignIn();
  });

  it('lets navigation through to a route open to everyone, without touching the session', async () => {
    await router.push({ name: 'activate' });
    expect(router.currentRoute.value.name).toBe('activate');
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
      data: { email: 'member@example.com', locale: 'en', timeZone: 'UTC' },
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    await router.push({ name: 'home' });
    expect(router.currentRoute.value.name).toBe('home');
  });

  it('skips the restore round trip once the session is already restored', async () => {
    const store = useSessionStore();
    store.setMember({ email: 'member@example.com', locale: 'en', timeZone: 'UTC' });
    store.restored = true;
    await router.push({ name: 'home' });
    expect(router.currentRoute.value.name).toBe('home');
    expect(apiClient.GET).not.toHaveBeenCalled();
  });

  it('restores the session before entering confirm-email-change, without redirecting', async () => {
    apiClient.GET.mockResolvedValueOnce(signedIn());
    await router.push({ name: 'confirm-email-change' });
    expect(router.currentRoute.value.name).toBe('confirm-email-change');
    expect(useSessionStore().isAuthenticated).toBe(true);
  });
});

describe('router guest-only pages', () => {
  beforeEach(async () => {
    localStorage.clear();
    await resetToSignIn();
    await router.push({ name: 'activate' });
  });

  it.each(['sign-in', 'register'])(
    'sends a member still signed in from %s to home, after a reload',
    async (name) => {
      apiClient.GET.mockResolvedValueOnce(signedIn());
      await router.push({ name });
      expect(router.currentRoute.value.name).toBe('home');
    },
  );

  it.each(['sign-in', 'register'])('renders %s for a signed-out visitor', async (name) => {
    apiClient.GET.mockResolvedValueOnce(signedOut());
    await router.push({ name });
    expect(router.currentRoute.value.name).toBe(name);
  });

  it('still renders sign-in when the session probe itself fails', async () => {
    apiClient.GET.mockRejectedValueOnce(new Error('network failure'));
    await router.push({ name: 'sign-in' });
    expect(router.currentRoute.value.name).toBe('sign-in');
    expect(apiClient.GET).toHaveBeenCalledTimes(1);
  });

  it('keeps the target locale on the redirect home', async () => {
    apiClient.GET.mockResolvedValueOnce(signedIn());
    await router.push({ name: 'sign-in', params: { locale: 'fr' } });
    expect(router.currentRoute.value.fullPath).toBe('/fr/home');
  });

  it('lets a signed-in member open an activation link', async () => {
    const store = useSessionStore();
    store.setMember({ email: 'member@example.com', locale: 'en', timeZone: 'UTC' });
    store.restored = true;
    await router.push({ name: 'activate', query: { key: 'abc' } });
    expect(router.currentRoute.value.name).toBe('activate');
  });
});

describe('router entry points', () => {
  beforeEach(async () => {
    localStorage.clear();
    await resetToSignIn();
    await router.push({ name: 'activate' });
  });

  it.each(['/', '/no/such/page'])('sends a signed-in member from %s to home', async (path) => {
    apiClient.GET.mockResolvedValueOnce(signedIn());
    await router.push(path);
    expect(router.currentRoute.value.fullPath).toBe('/en/home');
  });

  it.each(['/', '/no/such/page'])('sends a signed-out visitor from %s to sign-in', async (path) => {
    apiClient.GET.mockResolvedValueOnce(signedOut());
    await router.push(path);
    expect(router.currentRoute.value.fullPath).toBe('/en/sign-in');
  });
});

describe('router locale segment', () => {
  beforeEach(() => {
    apiClient.GET.mockReset();
    setActivePinia(createPinia());
    // These tests are about the locale, not the session.
    useSessionStore().restored = true;
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
    // Through home, which a signed-out visitor bounces off to sign-in.
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
    await router.push({ name: 'home', params: { locale: 'fr' } });
    expect(router.currentRoute.value.name).toBe('sign-in');
    expect(router.currentRoute.value.params.locale).toBe('fr');
  });
});

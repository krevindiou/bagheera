import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asMockedApiClient, mockApiClient } from '../test-support/mockApiClient';

vi.mock('../api/client', () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from '../api/client';
import { queryClient } from '../api/query-client';
import { useSessionStore } from './session.store';

const apiClient = asMockedApiClient(realApiClient);

describe('useSessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiClient.GET.mockReset();
  });

  it('starts signed out', () => {
    const store = useSessionStore();
    expect(store.member).toBeNull();
    expect(store.isAuthenticated).toBe(false);
    expect(store.restored).toBe(false);
  });

  describe('setMember/clear', () => {
    it('marks the store authenticated once a member is set', () => {
      const store = useSessionStore();
      store.setMember({ email: 'member@example.com', locale: 'en', timeZone: 'UTC' });
      expect(store.isAuthenticated).toBe(true);
      expect(store.member).toEqual({ email: 'member@example.com', locale: 'en', timeZone: 'UTC' });
    });

    it('clears the member and authentication state', () => {
      const store = useSessionStore();
      store.setMember({ email: 'member@example.com', locale: 'en', timeZone: 'UTC' });
      store.clear();
      expect(store.member).toBeNull();
      expect(store.isAuthenticated).toBe(false);
    });

    it("drops every cached query, so the next member never sees the previous one's data", () => {
      queryClient.setQueryData(['accounts'], [{ id: 'a1' }]);
      queryClient.setQueryData(['balance', 'a1'], { balance: 100 });
      const store = useSessionStore();
      store.setMember({ email: 'member@example.com', locale: 'en', timeZone: 'UTC' });

      store.clear();

      expect(queryClient.getQueryCache().getAll()).toEqual([]);
    });
  });

  describe('setLocale', () => {
    it('updates the locale of an already-set member', () => {
      const store = useSessionStore();
      store.setMember({ email: 'member@example.com', locale: 'en', timeZone: 'UTC' });
      store.setLocale('fr');
      expect(store.member).toEqual({
        email: 'member@example.com',
        locale: 'fr',
        timeZone: 'UTC',
      });
    });

    it('is a no-op when signed out', () => {
      const store = useSessionStore();
      store.setLocale('fr');
      expect(store.member).toBeNull();
    });
  });

  describe('setTimeZone', () => {
    it('updates the time zone of an already-set member', () => {
      const store = useSessionStore();
      store.setMember({ email: 'member@example.com', locale: 'en', timeZone: 'UTC' });
      store.setTimeZone('Europe/Paris');
      expect(store.member).toEqual({
        email: 'member@example.com',
        locale: 'en',
        timeZone: 'Europe/Paris',
      });
    });

    it('is a no-op when signed out', () => {
      const store = useSessionStore();
      store.setTimeZone('Europe/Paris');
      expect(store.member).toBeNull();
    });
  });

  describe('restore', () => {
    it('adopts the member returned by GET /auth/me', async () => {
      apiClient.GET.mockResolvedValueOnce({
        data: { email: 'member@example.com', locale: 'fr', timeZone: 'Europe/Paris' },
        error: undefined,
        response: new Response(null, { status: 200 }),
      });
      const store = useSessionStore();
      await store.restore();
      expect(store.member).toEqual({
        email: 'member@example.com',
        locale: 'fr',
        timeZone: 'Europe/Paris',
      });
      expect(store.restored).toBe(true);
    });

    it('clears the member when the session cookie is no longer valid', async () => {
      apiClient.GET.mockResolvedValueOnce({
        data: undefined,
        error: undefined,
        response: new Response(null, { status: 401 }),
      });
      const store = useSessionStore();
      store.setMember({ email: 'stale@example.com', locale: 'en', timeZone: 'UTC' });
      await store.restore();
      expect(store.member).toBeNull();
      expect(store.restored).toBe(true);
    });

    it('clears the member when the request itself rejects', async () => {
      apiClient.GET.mockRejectedValueOnce(new Error('network down'));
      const store = useSessionStore();
      await store.restore();
      expect(store.member).toBeNull();
      expect(store.restored).toBe(true);
    });

    it('performs the round trip only once for concurrent callers', async () => {
      apiClient.GET.mockResolvedValueOnce({
        data: { email: 'member@example.com', locale: 'en', timeZone: 'UTC' },
        error: undefined,
        response: new Response(null, { status: 200 }),
      });
      const store = useSessionStore();
      // Pinia wraps each action's promise, so they aren't `===`: assert one
      // network call instead.
      await Promise.all([store.restore(), store.restore()]);
      expect(apiClient.GET).toHaveBeenCalledTimes(1);
      expect(store.member).toEqual({ email: 'member@example.com', locale: 'en', timeZone: 'UTC' });
    });
  });

  describe('fetchMember', () => {
    it('always re-fetches, ignoring any earlier restore() result', async () => {
      apiClient.GET.mockResolvedValueOnce({
        data: undefined,
        error: undefined,
        response: new Response(null, { status: 401 }),
      });
      const store = useSessionStore();
      await store.restore();
      expect(store.member).toBeNull();

      apiClient.GET.mockResolvedValueOnce({
        data: { email: 'fresh@example.com', locale: 'fr' },
        error: undefined,
        response: new Response(null, { status: 200 }),
      });
      await store.fetchMember();
      expect(store.member).toEqual({ email: 'fresh@example.com', locale: 'fr' });
      expect(apiClient.GET).toHaveBeenCalledTimes(2);
    });
  });
});

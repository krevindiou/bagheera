import { defineStore } from 'pinia';
import { apiClient } from '../api/client';
import { queryClient } from '../api/query-client';
import type { Locale } from '../i18n/locales';

export interface SessionMember {
  email: string;
  locale: Locale;
  // IANA zone the member's "today" follows (see money.ts's today()).
  timeZone: string;
}

export const useSessionStore = defineStore('session', {
  state: () => ({
    member: null as SessionMember | null,
    // Whether `restore()` has asked the API if the session cookie, which
    // survives a reload unlike this store, is still valid.
    restored: false,
    restorePromise: null as Promise<void> | null,
  }),
  getters: {
    isAuthenticated: (state) => state.member !== null,
  },
  actions: {
    setMember(member: SessionMember | null) {
      this.member = member;
    },
    // Local update after `POST /members/locale` succeeds.
    setLocale(locale: Locale) {
      if (this.member) {
        this.member = { ...this.member, locale };
      }
    },
    // Same, after `POST /members/time-zone`.
    setTimeZone(timeZone: string) {
      if (this.member) {
        this.member = { ...this.member, timeZone };
      }
    },
    // Also drops every cached query, so the next member on this tab never
    // sees the previous one's data.
    clear() {
      this.member = null;
      queryClient.clear();
    },
    // Always hits the network, unlike restore(): used right after sign-in,
    // when an earlier restore() result is stale.
    async fetchMember(): Promise<void> {
      try {
        const { data } = await apiClient.GET('/auth/me');
        this.member = data
          ? { email: data.email, locale: data.locale, timeZone: data.timeZone }
          : null;
      } catch {
        this.member = null;
      } finally {
        this.restored = true;
      }
    },
    // One round trip per app load, however many callers.
    restore(): Promise<void> {
      if (this.restorePromise) return this.restorePromise;
      this.restorePromise = this.fetchMember();
      return this.restorePromise;
    },
  },
});

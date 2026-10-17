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
    // Whether the API has answered if the session cookie, which survives a
    // reload unlike this store, is still valid.
    restored: false,
    restorePromise: null as Promise<void> | null,
    // Set while an explicit sign-out navigates to sign-in, so a page's
    // refetch failing with 401 meanwhile doesn't add a redirect back to it.
    signingOut: false,
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
    // when an earlier restore() result is stale. Resolves to whether the API
    // answered: only a 401 means signed out, so an outage or a 5xx leaves
    // the member as they were rather than signing them out.
    async fetchMember(): Promise<boolean> {
      try {
        const { data, response } = await apiClient.GET('/auth/me');
        if (response.ok) {
          this.member = data
            ? { email: data.email, locale: data.locale, timeZone: data.timeZone }
            : null;
        } else if (response.status === 401) {
          this.member = null;
        } else {
          return false;
        }
      } catch {
        return false;
      }
      this.restored = true;
      return true;
    },
    // One round trip per app load, however many callers. A probe that got
    // no answer isn't kept, so the next caller asks again.
    restore(): Promise<void> {
      if (this.restorePromise) return this.restorePromise;
      this.restorePromise = this.fetchMember().then((answered) => {
        if (!answered) this.restorePromise = null;
      });
      return this.restorePromise;
    },
  },
});

import { defineStore } from 'pinia';
import { apiClient } from '../api/client';
import { queryClient } from '../api/query-client';
import type { Locale } from '../i18n/locales';

export interface SessionMember {
  email: string;
  locale: Locale;
}

export const useSessionStore = defineStore('session', {
  state: () => ({
    member: null as SessionMember | null,
    // The httpOnly session cookie survives a page refresh but this store
    // doesn't — `restore()` asks the API whether the cookie still carries a
    // valid session, so a reload doesn't bounce a signed-in member to the
    // sign-in page before that round trip has had a chance to complete.
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
    // Optimistic local update after the language switcher's own
    // `POST /members/locale` succeeds — avoids a round trip through
    // fetchMember() just to reflect a change this tab already knows about.
    setLocale(locale: Locale) {
      if (this.member) {
        this.member = { ...this.member, locale };
      }
    },
    // Sign-out and the 401 handler both land here. Dropping every cached
    // query too means whoever signs in next on this tab doesn't see the
    // previous member's accounts or balances while their own data loads.
    clear() {
      this.member = null;
      queryClient.clear();
    },
    // Always hits the network — unlike restore() below, never reuses a
    // cached result. Used right after sign-in (password or passkey), where
    // the member is known to have just changed and any earlier restore()
    // call (e.g. the router guard's, resolved to `null` while this was
    // still the sign-in page) must not be trusted anymore.
    async fetchMember(): Promise<void> {
      try {
        const { data } = await apiClient.GET('/auth/me');
        // The Swagger plugin can't infer a body schema from this
        // controller's plain-interface return type (see DashboardPage.vue
        // for the same pattern), so the generated type is untyped here.
        const member = data as SessionMember | undefined;
        this.member = member ? { email: member.email, locale: member.locale } : null;
      } catch {
        this.member = null;
      } finally {
        this.restored = true;
      }
    },
    // Idempotent and safe to call from multiple guards/components — only
    // ever performs the round trip once per app load.
    restore(): Promise<void> {
      if (this.restorePromise) return this.restorePromise;
      this.restorePromise = this.fetchMember();
      return this.restorePromise;
    },
  },
});

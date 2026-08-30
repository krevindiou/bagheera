import { defineStore } from "pinia";
import { apiClient } from "../api/client";

export interface SessionMember {
  email: string;
}

export const useSessionStore = defineStore("session", {
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
    clear() {
      this.member = null;
    },
    // Idempotent and safe to call from multiple guards/components — only
    // ever performs the round trip once per app load.
    restore(): Promise<void> {
      if (this.restorePromise) return this.restorePromise;
      this.restorePromise = apiClient
        .GET("/auth/me")
        .then(({ data }) => {
          // The Swagger plugin can't infer a body schema from this
          // controller's plain-interface return type (see DashboardPage.vue
          // for the same pattern), so the generated type is untyped here.
          const member = data as SessionMember | undefined;
          this.member = member ? { email: member.email } : null;
        })
        .catch(() => {
          this.member = null;
        })
        .finally(() => {
          this.restored = true;
        });
      return this.restorePromise;
    },
  },
});

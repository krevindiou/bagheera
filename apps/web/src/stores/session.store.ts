import { defineStore } from "pinia";

export interface SessionMember {
  // The API doesn't return the member's id/profile on sign-in (session-only
  // response) — the store only knows the email address the member signed
  // in with, which is enough to greet them until a "current member" read
  // endpoint exists.
  email: string;
}

export const useSessionStore = defineStore("session", {
  state: () => ({
    member: null as SessionMember | null,
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
  },
});

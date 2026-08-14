import { defineStore } from "pinia";

export interface SessionMember {
  id: string;
  email: string;
}

// Skeleton only: populated by the sign-in/sign-out flows added in
// later steps. Nothing calls the actions yet.
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

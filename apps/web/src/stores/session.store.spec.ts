import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asMockedApiClient, mockApiClient } from "../test-support/mockApiClient";

vi.mock("../api/client", () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from "../api/client";
import { useSessionStore } from "./session.store";

const apiClient = asMockedApiClient(realApiClient);

describe("useSessionStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiClient.GET.mockReset();
  });

  it("starts signed out", () => {
    const store = useSessionStore();
    expect(store.member).toBeNull();
    expect(store.isAuthenticated).toBe(false);
    expect(store.restored).toBe(false);
  });

  describe("setMember/clear", () => {
    it("marks the store authenticated once a member is set", () => {
      const store = useSessionStore();
      store.setMember({ email: "member@example.com" });
      expect(store.isAuthenticated).toBe(true);
      expect(store.member).toEqual({ email: "member@example.com" });
    });

    it("clears the member and authentication state", () => {
      const store = useSessionStore();
      store.setMember({ email: "member@example.com" });
      store.clear();
      expect(store.member).toBeNull();
      expect(store.isAuthenticated).toBe(false);
    });
  });

  describe("restore", () => {
    it("adopts the member returned by GET /auth/me", async () => {
      apiClient.GET.mockResolvedValueOnce({
        data: { email: "member@example.com" },
        error: undefined,
        response: new Response(null, { status: 200 }),
      });
      const store = useSessionStore();
      await store.restore();
      expect(store.member).toEqual({ email: "member@example.com" });
      expect(store.restored).toBe(true);
    });

    it("clears the member when the session cookie is no longer valid", async () => {
      apiClient.GET.mockResolvedValueOnce({
        data: undefined,
        error: undefined,
        response: new Response(null, { status: 401 }),
      });
      const store = useSessionStore();
      store.setMember({ email: "stale@example.com" });
      await store.restore();
      expect(store.member).toBeNull();
      expect(store.restored).toBe(true);
    });

    it("clears the member when the request itself rejects", async () => {
      apiClient.GET.mockRejectedValueOnce(new Error("network down"));
      const store = useSessionStore();
      await store.restore();
      expect(store.member).toBeNull();
      expect(store.restored).toBe(true);
    });

    it("performs the round trip only once for concurrent callers", async () => {
      apiClient.GET.mockResolvedValueOnce({
        data: { email: "member@example.com" },
        error: undefined,
        response: new Response(null, { status: 200 }),
      });
      const store = useSessionStore();
      // Pinia wraps each action call's returned promise in its own `.then()`,
      // so the two calls' return values aren't `===` even though the store
      // internally reuses the same underlying `restorePromise` — what
      // actually matters is both settle and only one network call happens.
      await Promise.all([store.restore(), store.restore()]);
      expect(apiClient.GET).toHaveBeenCalledTimes(1);
      expect(store.member).toEqual({ email: "member@example.com" });
    });
  });
});

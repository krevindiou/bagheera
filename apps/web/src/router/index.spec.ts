import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asMockedApiClient, mockApiClient } from "../test-support/mockApiClient";

vi.mock("../api/client", () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from "../api/client";
import { useSessionStore } from "../stores/session.store";
import { router } from "./index";

const apiClient = asMockedApiClient(realApiClient);

describe("router auth guard", () => {
  beforeEach(async () => {
    apiClient.GET.mockReset();
    setActivePinia(createPinia());
    await router.push({ name: "sign-in" });
  });

  it("lets navigation through to a route with no requiresAuth, without touching the session", async () => {
    await router.push({ name: "register" });
    expect(router.currentRoute.value.name).toBe("register");
    expect(apiClient.GET).not.toHaveBeenCalled();
  });

  it("redirects to sign-in when no Pinia instance is active", async () => {
    setActivePinia(undefined);
    await router.push({ name: "home" });
    expect(router.currentRoute.value.name).toBe("sign-in");
  });

  it("redirects to sign-in once restore() resolves with no active session", async () => {
    apiClient.GET.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 401 }),
    });
    await router.push({ name: "home" });
    expect(router.currentRoute.value.name).toBe("sign-in");
  });

  it("allows navigation once restore() resolves with an authenticated member", async () => {
    apiClient.GET.mockResolvedValueOnce({
      data: { email: "member@example.com" },
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    await router.push({ name: "home" });
    expect(router.currentRoute.value.name).toBe("home");
  });

  it("skips the restore round trip once the session is already restored", async () => {
    const store = useSessionStore();
    store.setMember({ email: "member@example.com" });
    store.restored = true;
    await router.push({ name: "home" });
    expect(router.currentRoute.value.name).toBe("home");
    expect(apiClient.GET).not.toHaveBeenCalled();
  });
});

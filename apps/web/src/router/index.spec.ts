import { describe, expect, it, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { router } from "./index";
import { apiClient } from "../api/client";
import { useSessionStore } from "../stores/session.store";

vi.mock("../api/client", () => ({
  apiClient: { GET: vi.fn() },
}));

describe("router", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(apiClient.GET).mockReset();
  });

  it("redirects the root path to the English sign-in page", async () => {
    await router.push("/");
    await router.isReady();
    expect(router.currentRoute.value.fullPath).toBe("/en/sign-in");
  });

  it("redirects unknown paths to the English sign-in page", async () => {
    await router.push("/does/not/exist");
    await router.isReady();
    expect(router.currentRoute.value.fullPath).toBe("/en/sign-in");
  });

  it("bounces to sign-in when the session cookie is no longer valid", async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({ data: undefined } as never);
    await router.push("/en/home");
    await router.isReady();
    expect(router.currentRoute.value.name).toBe("sign-in");
  });

  it("allows a requiresAuth route once /auth/me confirms an active session", async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({
      data: { email: "member@example.com" },
    } as never);
    await router.push("/en/home");
    await router.isReady();
    expect(router.currentRoute.value.name).toBe("home");
    expect(useSessionStore().isAuthenticated).toBe(true);
  });
});

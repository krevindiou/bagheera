import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { router } from "../../router";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import { useToast } from "../../composables/useToast";
import { waitForRouteName } from "../../test-support/waitForRouteName";
import ActivatePage from "./ActivatePage.vue";

vi.mock("../../api/client", () => ({
  apiClient: { POST: vi.fn() },
}));

function waitForSignIn() {
  return waitForRouteName(router, "sign-in");
}

describe("ActivatePage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.POST).mockReset();
    // The toast queue is a shared module-level singleton, rendered by
    // ToastContainer.vue (mounted separately in the real app shell, not
    // here) — read it directly instead of the page's own rendered text.
    useToast().toasts.splice(0);
  });

  it("activates using the key from the query string and shows success", async () => {
    vi.mocked(apiClient.POST).mockResolvedValue({ response: { ok: true, status: 200 } } as never);
    await router.push("/en/activate?key=valid-token");
    await router.isReady();

    mount(ActivatePage, { global: { plugins: [router, i18n] } });
    await waitForSignIn();

    expect(apiClient.POST).toHaveBeenCalledWith("/members/activate", {
      body: { key: "valid-token" },
    });
    const toast = useToast().toasts.find((t) => t.variant === "success");
    expect(toast?.text).toBe("Account activated. You can now sign in.");
  });

  it("shows the generic error for a rejected key", async () => {
    vi.mocked(apiClient.POST).mockResolvedValue({ response: { ok: false, status: 400 } } as never);
    await router.push("/en/activate?key=bad-token");
    await router.isReady();

    mount(ActivatePage, { global: { plugins: [router, i18n] } });
    await waitForSignIn();

    const toast = useToast().toasts.find((t) => t.variant === "error");
    expect(toast?.text).toBe("Activation error (Already activated?)");
  });

  it("shows the generic error when no key is present, without calling the API", async () => {
    await router.push("/en/activate");
    await router.isReady();

    mount(ActivatePage, { global: { plugins: [router, i18n] } });
    await waitForSignIn();

    expect(apiClient.POST).not.toHaveBeenCalled();
    const toast = useToast().toasts.find((t) => t.variant === "error");
    expect(toast?.text).toBe("Activation error (Already activated?)");
  });
});

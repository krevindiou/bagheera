import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { router } from "../../router";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import { useToast } from "../../composables/useToast";
import { waitForRouteName } from "../../test-support/waitForRouteName";
import ConfirmEmailChangePage from "./ConfirmEmailChangePage.vue";

vi.mock("../../api/client", () => ({
  apiClient: { POST: vi.fn() },
}));

function waitForSignIn() {
  return waitForRouteName(router, "sign-in");
}

describe("ConfirmEmailChangePage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.POST).mockReset();
    // The toast queue is a shared module-level singleton, rendered by
    // ToastContainer.vue (mounted separately in the real app shell, not
    // here) — read it directly instead of the page's own rendered text.
    useToast().toasts.splice(0);
  });

  it("confirms using the key from the query string and shows success", async () => {
    vi.mocked(apiClient.POST).mockResolvedValue({ response: { ok: true, status: 200 } } as never);
    await router.push("/en/confirm-email-change?key=valid-token");
    await router.isReady();

    mount(ConfirmEmailChangePage, { global: { plugins: [router, i18n] } });
    await waitForSignIn();

    expect(apiClient.POST).toHaveBeenCalledWith("/members/profile/confirm-email-change", {
      body: { key: "valid-token" },
    });
    const toast = useToast().toasts.find((t) => t.variant === "success");
    expect(toast?.text).toBe("Your email address has been updated.");
  });

  it("shows the generic error for a rejected key", async () => {
    vi.mocked(apiClient.POST).mockResolvedValue({ response: { ok: false, status: 400 } } as never);
    await router.push("/en/confirm-email-change?key=bad-token");
    await router.isReady();

    mount(ConfirmEmailChangePage, { global: { plugins: [router, i18n] } });
    await waitForSignIn();

    const toast = useToast().toasts.find((t) => t.variant === "error");
    expect(toast?.text).toBe("Email change error (link expired or already used?)");
  });

  it("shows the generic error when no key is present, without calling the API", async () => {
    await router.push("/en/confirm-email-change");
    await router.isReady();

    mount(ConfirmEmailChangePage, { global: { plugins: [router, i18n] } });
    await waitForSignIn();

    expect(apiClient.POST).not.toHaveBeenCalled();
    const toast = useToast().toasts.find((t) => t.variant === "error");
    expect(toast?.text).toBe("Email change error (link expired or already used?)");
  });
});

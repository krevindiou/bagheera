import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { router } from "../../router";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import { useToast } from "../../composables/useToast";
import { submitAndSettle } from "../../test-support/submitAndSettle";
import { waitForRouteName } from "../../test-support/waitForRouteName";
import ResetPasswordPage from "./ResetPasswordPage.vue";

vi.mock("../../api/client", () => ({
  apiClient: { POST: vi.fn() },
}));

async function goTo(key?: string) {
  await router.push(key ? `/en/reset-password?key=${key}` : "/en/reset-password");
  await router.isReady();
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.POST).mockReset();
    // The toast queue is a shared module-level singleton, rendered by
    // ToastContainer.vue (mounted separately in the real app shell, not
    // here) — read it directly instead of the page's own rendered text.
    useToast().toasts.splice(0);
  });

  it("rejects a short password and a mismatched confirmation", async () => {
    await goTo("valid-token");
    const wrapper = mount(ResetPasswordPage, { global: { plugins: [router, i18n] } });

    await wrapper.find("#reset-password-password").setValue("short");
    await wrapper.find("#reset-password-password-confirmation").setValue("different");
    await submitAndSettle(wrapper);

    expect(wrapper.findAll(".invalid-feedback")).toHaveLength(2);
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it("submits the key from the query string and shows success", async () => {
    vi.mocked(apiClient.POST).mockResolvedValue({ response: { ok: true, status: 200 } } as never);
    await goTo("valid-token");
    const wrapper = mount(ResetPasswordPage, { global: { plugins: [router, i18n] } });

    await wrapper.find("#reset-password-password").setValue("correct-horse");
    await wrapper.find("#reset-password-password-confirmation").setValue("correct-horse");
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith("/auth/password-recovery/reset", {
      body: {
        key: "valid-token",
        password: "correct-horse",
        passwordConfirmation: "correct-horse",
      },
    });
    const toast = useToast().toasts.find((t) => t.variant === "success");
    expect(toast?.text).toContain("Your password has been updated.");
    await waitForRouteName(router, "sign-in");
  });

  // A rejected key (missing, invalid, expired, already used) is a
  // *silent* return to sign-in — no banner, no toast, so the visitor
  // never learns which case applies.
  it("silently redirects to sign-in without calling the API when no key is present", async () => {
    await goTo();
    const wrapper = mount(ResetPasswordPage, { global: { plugins: [router, i18n] } });
    await submitAndSettle(wrapper);

    expect(apiClient.POST).not.toHaveBeenCalled();
    expect(useToast().toasts).toHaveLength(0);
    await waitForRouteName(router, "sign-in");
  });
});

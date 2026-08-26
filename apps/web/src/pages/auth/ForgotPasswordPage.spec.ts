import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { router } from "../../router";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import { useToast } from "../../composables/useToast";
import { submitAndSettle } from "../../test-support/submitAndSettle";
import { waitForRouteName } from "../../test-support/waitForRouteName";
import ForgotPasswordPage from "./ForgotPasswordPage.vue";

vi.mock("../../api/client", () => ({
  apiClient: { POST: vi.fn() },
}));

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.POST).mockReset();
    // The toast queue is a shared module-level singleton, rendered by
    // ToastContainer.vue (mounted separately in the real app shell, not
    // here) — read it directly instead of the page's own rendered text.
    useToast().toasts.splice(0);
  });

  it("rejects an invalid email", async () => {
    const wrapper = mount(ForgotPasswordPage, { global: { plugins: [router, i18n] } });

    await wrapper.find("#forgot-password-email").setValue("not-an-email");
    await submitAndSettle(wrapper);

    expect(wrapper.find(".invalid-feedback").exists()).toBe(true);
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it("shows the identical request-sent message regardless of whether the address matches", async () => {
    vi.mocked(apiClient.POST).mockResolvedValue({ response: { ok: true, status: 200 } } as never);
    const wrapper = mount(ForgotPasswordPage, { global: { plugins: [router, i18n] } });

    await wrapper.find("#forgot-password-email").setValue("someone@example.com");
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith("/auth/password-recovery", {
      body: { email: "someone@example.com" },
    });
    const toast = useToast().toasts.find((t) => t.variant === "info");
    expect(toast?.text).toContain("If an account exists for this address");
    await waitForRouteName(router, "sign-in");
  });
});

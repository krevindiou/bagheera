import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { router } from "../../router";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import { submitAndSettle } from "../../test-support/submitAndSettle";
import ForgotPasswordPage from "./ForgotPasswordPage.vue";

vi.mock("../../api/client", () => ({
  apiClient: { POST: vi.fn() },
}));

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.POST).mockReset();
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
    expect(wrapper.text()).toContain("If an account exists for this address");
  });
});

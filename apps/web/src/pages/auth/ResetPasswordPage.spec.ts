import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { router } from "../../router";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import { submitAndSettle } from "../../test-support/submitAndSettle";
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
    expect(wrapper.text()).toContain("Your password has been updated.");
  });

  it("shows the invalid-key banner without calling the API when no key is present", async () => {
    await goTo();
    const wrapper = mount(ResetPasswordPage, { global: { plugins: [router, i18n] } });

    await wrapper.find("#reset-password-password").setValue("correct-horse");
    await wrapper.find("#reset-password-password-confirmation").setValue("correct-horse");
    await submitAndSettle(wrapper);

    expect(apiClient.POST).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("This reset link is invalid or has expired.");
  });
});

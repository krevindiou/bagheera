import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { router } from "../../router";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import { useToast } from "../../composables/useToast";
import { submitAndSettle } from "../../test-support/submitAndSettle";
import PasswordPage from "./PasswordPage.vue";

vi.mock("../../api/client", () => ({
  apiClient: { POST: vi.fn() },
}));

function mountPage() {
  return mount(PasswordPage, { global: { plugins: [router, i18n] } });
}

describe("PasswordPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.POST).mockReset();
    useToast().toasts.splice(0);
  });

  it("rejects an empty current password, a short new password, and a mismatched confirmation", async () => {
    const wrapper = mountPage();

    await wrapper.find("#password-new").setValue("short");
    await wrapper.find("#password-new-confirmation").setValue("different");
    await submitAndSettle(wrapper);

    expect(wrapper.findAll(".invalid-feedback")).toHaveLength(3);
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it("submits and shows a success toast, then resets the form", async () => {
    vi.mocked(apiClient.POST).mockResolvedValue({
      response: { ok: true, status: 200 },
      error: undefined,
    } as never);
    const wrapper = mountPage();

    await wrapper.find("#password-current").setValue("correct-horse");
    await wrapper.find("#password-new").setValue("new-correct-horse");
    await wrapper.find("#password-new-confirmation").setValue("new-correct-horse");
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith("/auth/change-password", {
      body: {
        currentPassword: "correct-horse",
        newPassword: "new-correct-horse",
        newPasswordConfirmation: "new-correct-horse",
      },
    });
    expect(useToast().toasts.some((t) => t.variant === "success")).toBe(true);
    expect((wrapper.find("#password-current").element as HTMLInputElement).value).toBe("");
  });

  it("shows the API's error message in an error toast when the current password is wrong", async () => {
    vi.mocked(apiClient.POST).mockResolvedValue({
      response: { ok: false, status: 400 },
      error: { message: "Current password is incorrect." },
    } as never);
    const wrapper = mountPage();

    await wrapper.find("#password-current").setValue("wrong-password");
    await wrapper.find("#password-new").setValue("new-correct-horse");
    await wrapper.find("#password-new-confirmation").setValue("new-correct-horse");
    await submitAndSettle(wrapper);

    const toast = useToast().toasts.find((t) => t.variant === "error");
    expect(toast?.text).toBe("Current password is incorrect.");
  });
});

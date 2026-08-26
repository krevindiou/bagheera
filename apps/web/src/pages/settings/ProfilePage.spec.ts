import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { router } from "../../router";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import { useSessionStore } from "../../stores/session.store";
import { useToast } from "../../composables/useToast";
import { submitAndSettle } from "../../test-support/submitAndSettle";
import ProfilePage from "./ProfilePage.vue";

vi.mock("../../api/client", () => ({
  apiClient: { POST: vi.fn() },
}));

function mountPage() {
  return mount(ProfilePage, { global: { plugins: [router, i18n] } });
}

describe("ProfilePage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(apiClient.POST).mockReset();
    useToast().toasts.splice(0);
  });

  it("prefills the email field from the session", () => {
    useSessionStore().setMember({ email: "current@example.com" });
    const wrapper = mountPage();

    expect((wrapper.find("#profile-email").element as HTMLInputElement).value).toBe(
      "current@example.com",
    );
  });

  it("rejects an invalid email and an empty current password", async () => {
    const wrapper = mountPage();

    await wrapper.find("#profile-email").setValue("not-an-email");
    await submitAndSettle(wrapper);

    expect(wrapper.findAll(".invalid-feedback")).toHaveLength(2);
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it("updates the session email and shows a success toast", async () => {
    vi.mocked(apiClient.POST).mockResolvedValue({
      response: { ok: true, status: 200 },
      error: undefined,
    } as never);
    useSessionStore().setMember({ email: "old@example.com" });
    const wrapper = mountPage();

    await wrapper.find("#profile-email").setValue("new@example.com");
    await wrapper.find("#profile-current-password").setValue("correct-horse");
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith("/members/profile", {
      body: { email: "new@example.com", currentPassword: "correct-horse" },
    });
    expect(useSessionStore().member?.email).toBe("new@example.com");
    expect(useToast().toasts.some((t) => t.variant === "success")).toBe(true);
  });

  it("shows the API's error message as an inline field error on a rejected submission", async () => {
    vi.mocked(apiClient.POST).mockResolvedValue({
      response: { ok: false, status: 400 },
      error: { message: "Current password is invalid." },
    } as never);
    const wrapper = mountPage();

    await wrapper.find("#profile-email").setValue("new@example.com");
    await wrapper.find("#profile-current-password").setValue("wrong-password");
    await submitAndSettle(wrapper);

    expect(useToast().toasts.some((t) => t.variant === "error")).toBe(false);
    const field = wrapper.find("#profile-current-password").element.closest(".mb-3");
    expect(field?.querySelector(".invalid-feedback")?.textContent).toBe(
      "Current password is invalid.",
    );
  });
});

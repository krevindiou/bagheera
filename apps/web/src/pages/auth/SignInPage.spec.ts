import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { router } from "../../router";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import { submitAndSettle } from "../../test-support/submitAndSettle";
import SignInPage from "./SignInPage.vue";

vi.mock("../../api/client", () => ({
  apiClient: { POST: vi.fn() },
}));

function mountPage() {
  return mount(SignInPage, {
    global: { plugins: [router, i18n] },
  });
}

describe("SignInPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(apiClient.POST).mockReset();
    window.sessionStorage.clear();
  });

  it("shows validation errors for empty fields", async () => {
    const wrapper = mountPage();
    await submitAndSettle(wrapper);

    expect(wrapper.findAll(".invalid-feedback").length).toBeGreaterThan(0);
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it("shows the generic banner for invalid credentials", async () => {
    vi.mocked(apiClient.POST).mockResolvedValue({
      response: { ok: false, status: 401 },
    } as never);
    const wrapper = mountPage();

    await wrapper.find("#sign-in-email").setValue("nobody@example.com");
    await wrapper.find("#sign-in-password").setValue("wrong-password");
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain("Invalid email or password.");
  });

  it("shows the inactive-account banner with a working resend for a 403", async () => {
    vi.mocked(apiClient.POST)
      .mockResolvedValueOnce({ response: { ok: false, status: 403 } } as never)
      .mockResolvedValueOnce({ response: { ok: true, status: 200 } } as never);
    const wrapper = mountPage();

    await wrapper.find("#sign-in-email").setValue("inactive@example.com");
    await wrapper.find("#sign-in-password").setValue("correct-horse");
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain("Your account is not activated yet.");
    const resendButton = wrapper.find("button.btn-outline-secondary");
    expect(resendButton.exists()).toBe(true);

    await resendButton.trigger("click");
    await flushPromises();

    expect(apiClient.POST).toHaveBeenLastCalledWith("/members/resend-activation", {
      body: { email: "inactive@example.com", password: "correct-horse" },
    });
    expect(wrapper.text()).toContain("A new activation email has been sent.");
  });

  it("prefills the email field from the last attempted email", async () => {
    window.sessionStorage.setItem("bagheera.lastAttemptedEmail", "prefilled@example.com");
    const wrapper = mountPage();

    expect((wrapper.find("#sign-in-email").element as HTMLInputElement).value).toBe(
      "prefilled@example.com",
    );
  });
});

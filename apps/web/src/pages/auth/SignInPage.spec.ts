import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { router } from "../../router";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import { submitAndSettle } from "../../test-support/submitAndSettle";
import SignInPage from "./SignInPage.vue";

vi.mock("../../api/client", () => ({
  apiClient: { POST: vi.fn(), GET: vi.fn() },
}));

vi.mock("@simplewebauthn/browser", () => ({
  browserSupportsWebAuthn: () => true,
  startAuthentication: vi.fn(),
}));

import { startAuthentication } from "@simplewebauthn/browser";

function mountPage() {
  return mount(SignInPage, {
    global: { plugins: [router, i18n] },
  });
}

describe("SignInPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(apiClient.POST).mockReset();
    // The post-sign-in redirect to "home" runs the router guard, which
    // restores the session via GET /auth/me — give it a harmless default so
    // that navigation doesn't reject with "apiClient.GET is not a function".
    vi.mocked(apiClient.GET)
      .mockReset()
      .mockResolvedValue({ data: undefined } as never);
    vi.mocked(startAuthentication).mockReset();
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

    expect(wrapper.text()).toContain("Invalid email or password");
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

  it("prompts for an email before attempting a passkey sign-in", async () => {
    const wrapper = mountPage();

    await wrapper.find("button.btn-outline-secondary").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Enter your email address first.");
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it("signs in with a passkey end to end", async () => {
    vi.mocked(apiClient.POST)
      .mockResolvedValueOnce({
        data: { challenge: "c", rp: {}, allowCredentials: [] },
        response: { ok: true },
      } as never)
      .mockResolvedValueOnce({ response: { ok: true } } as never);
    vi.mocked(startAuthentication).mockResolvedValue({ id: "cred-1" } as never);

    const wrapper = mountPage();
    await wrapper.find("#sign-in-email").setValue("passkey@example.com");
    await wrapper.find("button.btn-outline-secondary").trigger("click");
    await flushPromises();

    expect(apiClient.POST).toHaveBeenNthCalledWith(1, "/webauthn/authentication/options", {
      body: { email: "passkey@example.com" },
    });
    expect(apiClient.POST).toHaveBeenNthCalledWith(2, "/webauthn/authentication/verify", {
      body: { response: { id: "cred-1" } },
    });
    expect(wrapper.text()).not.toContain("Invalid email or password");
  });

  it("shows the generic banner when the passkey ceremony is rejected server-side", async () => {
    vi.mocked(apiClient.POST).mockResolvedValueOnce({
      data: { challenge: "c", rp: {}, allowCredentials: [] },
      response: { ok: true },
    } as never);
    vi.mocked(startAuthentication).mockResolvedValue({ id: "cred-1" } as never);
    vi.mocked(apiClient.POST).mockResolvedValueOnce({
      response: { ok: false, status: 401 },
    } as never);

    const wrapper = mountPage();
    await wrapper.find("#sign-in-email").setValue("passkey@example.com");
    await wrapper.find("button.btn-outline-secondary").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Invalid email or password");
  });

  it("prefills the email field from the last attempted email", async () => {
    window.sessionStorage.setItem("bagheera.lastAttemptedEmail", "prefilled@example.com");
    const wrapper = mountPage();

    expect((wrapper.find("#sign-in-email").element as HTMLInputElement).value).toBe(
      "prefilled@example.com",
    );
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { router } from "../../router";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import { useToast } from "../../composables/useToast";
import { submitAndSettle } from "../../test-support/submitAndSettle";
import { waitForRouteName } from "../../test-support/waitForRouteName";
import RegisterPage from "./RegisterPage.vue";

vi.mock("../../api/client", () => ({
  apiClient: { POST: vi.fn() },
}));

function mountPage() {
  return mount(RegisterPage, { global: { plugins: [router, i18n] } });
}

async function fillValidForm(wrapper: ReturnType<typeof mountPage>) {
  await wrapper.find("#register-email").setValue("new@example.com");
  await wrapper.find("#register-country").setValue("FR");
  await wrapper.find("#register-password").setValue("correct-horse");
  await wrapper.find("#register-password-confirmation").setValue("correct-horse");
}

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.POST).mockReset();
    // The toast queue is a shared module-level singleton, rendered by
    // ToastContainer.vue (mounted separately in the real app shell, not
    // here) — read it directly instead of the page's own rendered text.
    useToast().toasts.splice(0);
  });

  it("rejects an invalid email, a short password, and a mismatched confirmation", async () => {
    const wrapper = mountPage();

    await wrapper.find("#register-email").setValue("not-an-email");
    await wrapper.find("#register-password").setValue("short");
    await wrapper.find("#register-password-confirmation").setValue("different");
    await submitAndSettle(wrapper);

    const messages = wrapper.findAll(".invalid-feedback").map((el) => el.text());
    expect(messages).toHaveLength(3);
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it("renders the country field as a dropdown of ISO codes, defaulting to the US", () => {
    const wrapper = mountPage();

    const select = wrapper.find("#register-country");
    expect(select.element.tagName).toBe("SELECT");
    expect((select.element as HTMLSelectElement).value).toBe("US");
    expect(select.findAll("option").length).toBeGreaterThan(100);
  });

  it("submits the selected country and shows the success message", async () => {
    vi.mocked(apiClient.POST).mockResolvedValue({
      response: { ok: true, status: 201 },
    } as never);
    const wrapper = mountPage();

    await wrapper.find("#register-email").setValue("new@example.com");
    await wrapper.find("#register-country").setValue("FR");
    await wrapper.find("#register-password").setValue("correct-horse");
    await wrapper.find("#register-password-confirmation").setValue("correct-horse");
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith("/members/register", {
      body: {
        email: "new@example.com",
        country: "FR",
        password: "correct-horse",
        passwordConfirmation: "correct-horse",
      },
    });
    const toast = useToast().toasts.find((t) => t.variant === "info");
    expect(toast?.text).toContain("You are now registered.");
    await waitForRouteName(router, "sign-in");
  });

  it("shows the email-taken banner on a rejected submission", async () => {
    vi.mocked(apiClient.POST).mockResolvedValue({
      response: { ok: false, status: 400 },
    } as never);
    const wrapper = mountPage();
    await fillValidForm(wrapper);
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain("Email is already registered.");
  });
});

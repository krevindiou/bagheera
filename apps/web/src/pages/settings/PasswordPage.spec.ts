import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { asMockedApiClient, mockApiClient } from "../../test-support/mockApiClient";
import { submitAndSettle } from "../../test-support/submitAndSettle";
import { withGlobalPlugins } from "../../test-support/withGlobalPlugins";

vi.mock("../../api/client", () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from "../../api/client";
import { useToast } from "../../composables/useToast";
import PasswordPage from "./PasswordPage.vue";

const apiClient = asMockedApiClient(realApiClient);

function jsonResult(status: number, error?: unknown) {
  return { data: undefined, error, response: new Response(null, { status }) };
}

async function fillValidForm(wrapper: VueWrapper) {
  await wrapper.find("#password-current").setValue("hunter2");
  await wrapper.find("#password-new").setValue("longenough1");
  await wrapper.find("#password-new-confirmation").setValue("longenough1");
}

describe("PasswordPage", () => {
  beforeEach(() => {
    apiClient.POST.mockReset();
    useToast().toasts.splice(0);
  });

  it("submits the change, resets every field, and shows a success toast", async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mount(PasswordPage, withGlobalPlugins());
    await fillValidForm(wrapper);
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith("/auth/change-password", {
      body: {
        currentPassword: "hunter2",
        newPassword: "longenough1",
        newPasswordConfirmation: "longenough1",
      },
    });
    expect((wrapper.find("#password-new").element as HTMLInputElement).value).toBe("");
    expect(wrapper.text()).toContain("Your password has been updated.");
  });

  it("shows an inline field error (not a toast) for an invalid current password", async () => {
    apiClient.POST.mockResolvedValueOnce(
      jsonResult(400, { message: "Current password is invalid." }),
    );
    const wrapper = mount(PasswordPage, withGlobalPlugins());
    await fillValidForm(wrapper);
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain("Current password is invalid.");
    expect(useToast().toasts).toHaveLength(0);
  });

  it("shows a toast for any other failure", async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(400, { message: "Rate limited" }));
    const wrapper = mount(PasswordPage, withGlobalPlugins());
    await fillValidForm(wrapper);
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain("Rate limited");
  });

  it("falls back to a generic error toast when the change fails without a message", async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(500));
    const wrapper = mount(PasswordPage, withGlobalPlugins());
    await fillValidForm(wrapper);
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain("Something went wrong. Please try again.");
  });

  it("shows a validation error and doesn't submit for mismatched passwords", async () => {
    const wrapper = mount(PasswordPage, withGlobalPlugins());
    await wrapper.find("#password-current").setValue("hunter2");
    await wrapper.find("#password-new").setValue("longenough1");
    await wrapper.find("#password-new-confirmation").setValue("different1");
    await submitAndSettle(wrapper);

    expect(wrapper.text()).toContain("Passwords don't match.");
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it("shows the strength meter reacting to the new password", async () => {
    const wrapper = mount(PasswordPage, withGlobalPlugins());
    await wrapper.find("#password-new").setValue("aA1!aA1!aA1!aA1!");
    expect(wrapper.text()).toContain("Strong");
  });
});

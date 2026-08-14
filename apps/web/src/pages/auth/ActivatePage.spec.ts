import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { router } from "../../router";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import ActivatePage from "./ActivatePage.vue";

vi.mock("../../api/client", () => ({
  apiClient: { POST: vi.fn() },
}));

describe("ActivatePage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.POST).mockReset();
  });

  it("activates using the key from the query string and shows success", async () => {
    vi.mocked(apiClient.POST).mockResolvedValue({ response: { ok: true, status: 200 } } as never);
    await router.push("/en/activate?key=valid-token");
    await router.isReady();

    const wrapper = mount(ActivatePage, { global: { plugins: [router, i18n] } });
    await flushPromises();

    expect(apiClient.POST).toHaveBeenCalledWith("/members/activate", {
      body: { key: "valid-token" },
    });
    expect(wrapper.text()).toContain("Account activated. You can now sign in.");
  });

  it("shows the generic error for a rejected key", async () => {
    vi.mocked(apiClient.POST).mockResolvedValue({ response: { ok: false, status: 400 } } as never);
    await router.push("/en/activate?key=bad-token");
    await router.isReady();

    const wrapper = mount(ActivatePage, { global: { plugins: [router, i18n] } });
    await flushPromises();

    expect(wrapper.text()).toContain("Activation error (Already activated?)");
  });

  it("shows the generic error when no key is present, without calling the API", async () => {
    await router.push("/en/activate");
    await router.isReady();

    const wrapper = mount(ActivatePage, { global: { plugins: [router, i18n] } });
    await flushPromises();

    expect(apiClient.POST).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Activation error (Already activated?)");
  });
});

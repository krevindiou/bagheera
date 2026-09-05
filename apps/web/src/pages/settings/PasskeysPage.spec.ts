import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import { router } from "../../router";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import { useToast } from "../../composables/useToast";
import PasskeysPage from "./PasskeysPage.vue";

vi.mock("../../api/client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), DELETE: vi.fn() },
}));

vi.mock("@simplewebauthn/browser", () => ({
  startRegistration: vi.fn(),
}));

import { startRegistration } from "@simplewebauthn/browser";

function mountPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return mount(PasskeysPage, {
    global: { plugins: [router, i18n, [VueQueryPlugin, { queryClient }]] },
  });
}

describe("PasskeysPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.GET).mockReset();
    vi.mocked(apiClient.POST).mockReset();
    vi.mocked(startRegistration).mockReset();
    useToast().toasts.splice(0);
  });

  it("shows the empty state with no registered passkeys", async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({ data: [], response: { ok: true } } as never);
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain("You don't have any passkey yet.");
  });

  it("lists a registered passkey with its device name", async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({
      data: [
        {
          id: 1,
          deviceName: "My laptop",
          createdAt: "2026-01-01T00:00:00.000Z",
          lastUsedAt: null,
        },
      ],
      response: { ok: true },
    } as never);
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain("My laptop");
    expect(wrapper.text()).toContain("Never");
  });

  it("registers a new passkey and refreshes the list on success", async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({ data: [], response: { ok: true } } as never);
    vi.mocked(apiClient.POST)
      .mockResolvedValueOnce({
        data: { challenge: "c", rp: {}, user: {} },
        response: { ok: true },
      } as never)
      .mockResolvedValueOnce({ response: { ok: true } } as never);
    vi.mocked(startRegistration).mockResolvedValue({ id: "cred-1" } as never);

    const wrapper = mountPage();
    await flushPromises();

    await wrapper.find("#passkey-device-name").setValue("Work phone");
    await wrapper.find("button.btn-primary").trigger("click");
    await flushPromises();

    expect(apiClient.POST).toHaveBeenNthCalledWith(2, "/webauthn/registration/verify", {
      body: { response: { id: "cred-1" }, deviceName: "Work phone" },
    });
    expect(useToast().toasts.some((t) => t.text === "Passkey added")).toBe(true);
  });

  it("abandons silently when the platform prompt is cancelled", async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({ data: [], response: { ok: true } } as never);
    vi.mocked(apiClient.POST).mockResolvedValueOnce({
      data: { challenge: "c", rp: {}, user: {} },
      response: { ok: true },
    } as never);
    vi.mocked(startRegistration).mockRejectedValue(new Error("cancelled"));

    const wrapper = mountPage();
    await flushPromises();

    await wrapper.find("button.btn-primary").trigger("click");
    await flushPromises();

    expect(apiClient.POST).toHaveBeenCalledTimes(1);
    expect(useToast().toasts).toHaveLength(0);
  });
});

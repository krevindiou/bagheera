import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { router } from "../../router";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import { submitAndSettle } from "../../test-support/submitAndSettle";
import AccountsPage from "./AccountsPage.vue";

vi.mock("../../api/client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}));

function mountPage() {
  return mount(AccountsPage, { global: { plugins: [router, i18n] } });
}

describe("AccountsPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.GET).mockReset();
    vi.mocked(apiClient.POST).mockReset();
  });

  it("shows closed and deleted badges for banks and accounts", async () => {
    vi.mocked(apiClient.GET).mockImplementation((path: string) => {
      if (path === "/banks") {
        return Promise.resolve({
          data: [
            { id: 1, name: "Active Bank", closed: false, deleted: false },
            { id: 2, name: "Closed Bank", closed: true, deleted: false },
          ],
          response: { ok: true },
        }) as never;
      }
      return Promise.resolve({
        data: [
          { id: 10, bankId: 1, name: "Checking", currency: "USD", closed: false, deleted: false },
          { id: 11, bankId: 1, name: "Old account", currency: "USD", closed: true, deleted: true },
        ],
        response: { ok: true },
      }) as never;
    });

    const wrapper = mountPage();
    await flushPromises();

    const bankRows = wrapper.findAll('[data-testid="bank-row"]');
    expect(bankRows[1]!.text()).toContain("Closed");

    const accountRows = wrapper.findAll('[data-testid="account-row"]');
    expect(accountRows[1]!.text()).toContain("Closed");
    expect(accountRows[1]!.text()).toContain("Deleted");
  });

  it("rejects submitting both an existing bank and a new bank name", async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({
      data: [{ id: 1, name: "Active Bank", closed: false, deleted: false }],
      response: { ok: true },
    } as never);
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.find("button.btn-primary").trigger("click");
    await wrapper.vm.$nextTick();

    await wrapper.find("#account-bank-id").setValue("1");
    await wrapper.find("#account-bank-name").setValue("New Bank");
    await wrapper.find("#account-name").setValue("Checking");
    await wrapper.find("#account-currency").setValue("USD");
    await submitAndSettle(wrapper);

    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it("rejects submitting neither an existing bank nor a new bank name", async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({
      data: [{ id: 1, name: "Active Bank", closed: false, deleted: false }],
      response: { ok: true },
    } as never);
    const wrapper = mountPage();
    await flushPromises();

    await wrapper.find("button.btn-primary").trigger("click");
    await wrapper.vm.$nextTick();

    await wrapper.find("#account-name").setValue("Checking");
    await wrapper.find("#account-currency").setValue("USD");
    await submitAndSettle(wrapper);

    expect(apiClient.POST).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Choose an existing bank or type a new bank name, not both.");
  });

  it("creates a new bank via the choice endpoint then the account", async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({ data: [], response: { ok: true } } as never);
    vi.mocked(apiClient.POST).mockImplementation((path: string) => {
      if (path === "/banks/choice") {
        return Promise.resolve({ data: { id: 5, name: "New Bank", created: true }, response: { ok: true } }) as never;
      }
      return Promise.resolve({ data: { id: 20 }, response: { ok: true } }) as never;
    });

    const wrapper = mountPage();
    await flushPromises();

    await wrapper.find("button.btn-primary").trigger("click");
    await wrapper.vm.$nextTick();

    await wrapper.find("#account-bank-name").setValue("New Bank");
    await wrapper.find("#account-name").setValue("Checking");
    await wrapper.find("#account-currency").setValue("USD");
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith("/banks/choice", { body: { name: "New Bank" } });
    expect(apiClient.POST).toHaveBeenCalledWith("/accounts", {
      body: { bankId: 5, name: "Checking", currency: "USD", initialBalance: undefined },
    });
  });
});

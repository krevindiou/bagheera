import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import OperationForm from "./OperationForm.vue";
import type { Category } from "./operations.types";

vi.mock("../../api/client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}));

const categories: Category[] = [
  { id: 1, parentId: null, type: "credit", name: "Salary", isSalaryCategory: true },
  { id: 2, parentId: null, type: "debit", name: "Food", isSalaryCategory: false },
];

function mountForm() {
  return mount(OperationForm, {
    props: {
      accountId: 1,
      categories,
      accounts: [
        { id: 2, bankId: 1, name: "Savings", currency: "USD", closed: false, deleted: false },
      ],
    },
    global: { plugins: [i18n] },
  });
}

describe("OperationForm", () => {
  beforeEach(() => {
    vi.mocked(apiClient.GET).mockReset();
    vi.mocked(apiClient.POST).mockReset();
    vi.mocked(apiClient.GET).mockResolvedValue({ data: [], response: { ok: true } } as never);
  });

  it("only shows categories and payment methods matching the selected type", async () => {
    const wrapper = mountForm();

    const categoryOptionsDebit = wrapper.findAll("#operation-category option").map((o) => o.text());
    expect(categoryOptionsDebit).toContain("Food");
    expect(categoryOptionsDebit).not.toContain("Salary");

    await wrapper.find("#operation-type-credit").setValue(true);
    await wrapper.vm.$nextTick();

    const categoryOptionsCredit = wrapper
      .findAll("#operation-category option")
      .map((o) => o.text());
    expect(categoryOptionsCredit).toContain("Salary");
    expect(categoryOptionsCredit).not.toContain("Food");
  });

  it("only shows the transfer-account field for a transfer payment method", async () => {
    const wrapper = mountForm();
    expect(wrapper.find("#operation-transfer-account").exists()).toBe(false);

    await wrapper.find("#operation-payment-method").setValue("4");
    await wrapper.vm.$nextTick();

    expect(wrapper.find("#operation-transfer-account").exists()).toBe(true);
  });

  it("fills the category from an exact autocomplete match", async () => {
    vi.mocked(apiClient.GET).mockResolvedValue({
      data: [{ thirdParty: "Landlord", categoryId: 2 }],
      response: { ok: true },
    } as never);
    const wrapper = mountForm();

    await wrapper.find("#operation-third-party").setValue("Landlord");
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 350));
    await wrapper.vm.$nextTick();

    expect(apiClient.GET).toHaveBeenCalledWith("/operations/autocomplete", {
      params: { query: { q: "Landlord", type: "debit" } },
    });
    const select = wrapper.get<HTMLSelectElement>("#operation-category").element;
    expect(select.value).toBe("2");
  });
});

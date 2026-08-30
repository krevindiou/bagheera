import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import { submitAndSettle } from "../../test-support/submitAndSettle";
import SchedulerForm from "./SchedulerForm.vue";
import type { Category } from "../operations/operations.types";

vi.mock("../../api/client", () => ({
  apiClient: { POST: vi.fn(), PATCH: vi.fn() },
}));

const categories: Category[] = [
  { id: 1, parentId: null, type: "credit", name: "Salary" },
  { id: 2, parentId: null, type: "debit", name: "Food" },
];

function mountForm() {
  return mount(SchedulerForm, {
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

describe("SchedulerForm", () => {
  beforeEach(() => {
    vi.mocked(apiClient.POST).mockReset();
    vi.mocked(apiClient.PATCH).mockReset();
  });

  it("only shows categories and payment methods matching the selected type — same field logic as the operation form", async () => {
    const wrapper = mountForm();

    const categoryOptionsDebit = wrapper.findAll("#scheduler-category option").map((o) => o.text());
    expect(categoryOptionsDebit).toContain("Food");
    expect(categoryOptionsDebit).not.toContain("Salary");

    await wrapper.find("#scheduler-type-credit").setValue(true);
    await wrapper.vm.$nextTick();

    const categoryOptionsCredit = wrapper
      .findAll("#scheduler-category option")
      .map((o) => o.text());
    expect(categoryOptionsCredit).toContain("Salary");
    expect(categoryOptionsCredit).not.toContain("Food");
  });

  it("only shows the transfer-account field for a transfer payment method", async () => {
    const wrapper = mountForm();
    expect(wrapper.find("#scheduler-transfer-account").exists()).toBe(false);

    await wrapper.find("#scheduler-payment-method").setValue("4");
    await wrapper.vm.$nextTick();

    expect(wrapper.find("#scheduler-transfer-account").exists()).toBe(true);
  });

  it("submits the recurrence fields alongside the operation-like fields", async () => {
    vi.mocked(apiClient.POST).mockResolvedValue({
      data: { message: "Scheduler saved", scheduler: { id: 9 } },
      response: { ok: true },
    } as never);

    const wrapper = mountForm();
    await wrapper.find("#scheduler-third-party").setValue("Rent");
    await wrapper.find("#scheduler-amount").setValue("100");
    await wrapper.find("#scheduler-payment-method").setValue("1");
    await wrapper.find("#scheduler-frequency-value").setValue("2");
    await wrapper.find("#scheduler-frequency-unit").setValue("week");
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith(
      "/schedulers",
      expect.objectContaining({
        body: expect.objectContaining({
          accountId: 1,
          thirdParty: "Rent",
          frequencyValue: 2,
          frequencyUnit: "week",
        }),
      }),
    );
  });
});

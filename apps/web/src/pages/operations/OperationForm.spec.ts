import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { asMockedApiClient, mockApiClient } from "../../test-support/mockApiClient";
import { submitAndSettle } from "../../test-support/submitAndSettle";
import { withGlobalPlugins } from "../../test-support/withGlobalPlugins";

vi.mock("../../api/client", () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from "../../api/client";
import { useToast } from "../../composables/useToast";
import type { Account, Bank } from "../accounts/accounts.types";
import OperationForm from "./OperationForm.vue";
import { PAYMENT_METHOD_ID } from "./operations.types";
import type { Category, Operation, PaymentMethod } from "./operations.types";

const apiClient = asMockedApiClient(realApiClient);

// operationSchema validates category/payment-method/account ids as real
// uuids, so fixtures need uuid-shaped ids, not plain "c1"/"a1" labels.
const CATEGORY_FOOD = "00000000-0000-7000-8000-000000000101";
const CATEGORY_SALARY = "00000000-0000-7000-8000-000000000102";
const ACCOUNT_CHECKING = "00000000-0000-7000-8000-000000000201";
const ACCOUNT_SAVINGS = "00000000-0000-7000-8000-000000000202";

const categories: Category[] = [
  { id: CATEGORY_FOOD, parentId: null, type: "debit", name: "Food" },
  { id: CATEGORY_SALARY, parentId: null, type: "credit", name: "Salary" },
];
const paymentMethods: PaymentMethod[] = [
  { id: PAYMENT_METHOD_ID.CHECK_DEBIT, name: "Check", type: "debit" },
  { id: PAYMENT_METHOD_ID.DEPOSIT, name: "Deposit", type: "credit" },
  { id: PAYMENT_METHOD_ID.TRANSFER_DEBIT, name: "Transfer debit", type: "debit" },
];
const accounts: Account[] = [
  {
    id: ACCOUNT_CHECKING,
    bankId: "b1",
    name: "Checking",
    currency: "USD",
    closed: false,
    deleted: false,
  },
  {
    id: ACCOUNT_SAVINGS,
    bankId: "b1",
    name: "Savings",
    currency: "USD",
    closed: false,
    deleted: false,
  },
];
const banks: Bank[] = [{ id: "b1", name: "Chase", closed: false, deleted: false }];

const operation: Operation = {
  id: "o1",
  accountId: ACCOUNT_CHECKING,
  schedulerId: null,
  transferOperationId: null,
  transferAccountId: null,
  categoryId: CATEGORY_FOOD,
  paymentMethodId: PAYMENT_METHOD_ID.CHECK_DEBIT,
  thirdParty: "Landlord",
  debit: 500000,
  credit: null,
  valueDate: "2026-01-15",
  reconciled: false,
  notes: "rent",
};

function mountForm(overrides: { operation?: Operation | null; attachTo?: Element } = {}) {
  const { attachTo, operation: operationOverride } = overrides;
  return mount(OperationForm, {
    ...withGlobalPlugins(),
    ...(attachTo ? { attachTo } : {}),
    props: {
      accountId: ACCOUNT_CHECKING,
      categories,
      paymentMethods,
      accounts,
      banks,
      operation: operationOverride,
    },
  });
}

function jsonResult(status: number, data?: unknown, error?: unknown) {
  return { data, error, response: new Response(null, { status }) };
}

describe("OperationForm", () => {
  beforeEach(() => {
    apiClient.POST.mockReset();
    apiClient.PATCH.mockReset();
    apiClient.GET.mockReset();
    apiClient.GET.mockResolvedValue(jsonResult(200, []));
    useToast().toasts.splice(0);
  });

  it("creates an operation and emits saved", async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mountForm();
    await wrapper.find("#operation-third-party").setValue("Landlord");
    await wrapper.find("#operation-amount").setValue("50");
    await wrapper.find("#operation-payment-method").setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
    await wrapper.find("#operation-category").setValue(CATEGORY_FOOD);
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith("/operations", {
      body: {
        accountId: ACCOUNT_CHECKING,
        type: "debit",
        thirdParty: "Landlord",
        amount: 50,
        categoryId: CATEGORY_FOOD,
        paymentMethodId: PAYMENT_METHOD_ID.CHECK_DEBIT,
        transferAccountId: undefined,
        valueDate: expect.any(String),
        notes: "",
        reconciled: false,
      },
    });
    expect(useToast().toasts[0]?.text).toBe("Operation saved");
    expect(wrapper.emitted("saved")).toHaveLength(1);
  });

  it("'Save & add another' resets the form and emits savedAndNew instead of closing", async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mountForm();
    await wrapper.find("#operation-third-party").setValue("Landlord");
    await wrapper.find("#operation-amount").setValue("50");
    await wrapper.find("#operation-payment-method").setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
    await wrapper.find("button.btn-outline-primary").trigger("click");
    // This button goes through the same vee-validate handleSubmit chain as
    // a form submit, which needs several flush/tick rounds to settle (see
    // submitAndSettle) — but it isn't a form submit, so that helper (which
    // triggers a "submit" event) doesn't apply; loop the same way inline.
    for (let i = 0; i < 5; i++) {
      await flushPromises();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await nextTick();
    }

    expect(wrapper.emitted("savedAndNew")).toHaveLength(1);
    expect(wrapper.emitted("saved")).toBeUndefined();
    expect((wrapper.find("#operation-third-party").element as HTMLInputElement).value).toBe("");
  });

  it("doesn't offer 'Save & add another' when editing", () => {
    const wrapper = mountForm({ operation });
    expect(wrapper.find("button.btn-outline-primary").exists()).toBe(false);
  });

  it("prefills from the operation being edited, converting the stored amount", () => {
    const wrapper = mountForm({ operation });
    expect((wrapper.find("#operation-third-party").element as HTMLInputElement).value).toBe(
      "Landlord",
    );
    expect((wrapper.find("#operation-amount").element as HTMLInputElement).value).toBe("50");
    expect((wrapper.find("#operation-type-debit").element as HTMLInputElement).checked).toBe(true);
    expect((wrapper.find("#operation-category").element as HTMLSelectElement).value).toBe(
      CATEGORY_FOOD,
    );
  });

  it("updates an operation via PATCH and emits saved", async () => {
    apiClient.PATCH.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mountForm({ operation });
    await wrapper.find("#operation-amount").setValue("75");
    await submitAndSettle(wrapper);

    expect(apiClient.PATCH).toHaveBeenCalledWith("/operations/{id}", {
      params: { path: { id: "o1" } },
      body: expect.objectContaining({ amount: 75 }),
    });
    expect(wrapper.emitted("saved")).toHaveLength(1);
  });

  it("shows the transfer-account field only for a transfer payment method, and includes it in the body", async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mountForm();
    expect(wrapper.find("#operation-transfer-account").exists()).toBe(false);

    await wrapper.find("#operation-payment-method").setValue(PAYMENT_METHOD_ID.TRANSFER_DEBIT);
    expect(wrapper.find("#operation-transfer-account").exists()).toBe(true);

    await wrapper.find("#operation-third-party").setValue("Savings transfer");
    await wrapper.find("#operation-amount").setValue("20");
    await wrapper.find("#operation-transfer-account").setValue(ACCOUNT_SAVINGS);
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith(
      "/operations",
      expect.objectContaining({
        body: expect.objectContaining({ transferAccountId: ACCOUNT_SAVINGS }),
      }),
    );
  });

  it("drops the transfer account from the body once switched back to a non-transfer method", async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mountForm();
    await wrapper.find("#operation-payment-method").setValue(PAYMENT_METHOD_ID.TRANSFER_DEBIT);
    await wrapper.find("#operation-transfer-account").setValue(ACCOUNT_SAVINGS);
    await wrapper.find("#operation-payment-method").setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
    await wrapper.find("#operation-third-party").setValue("Rent");
    await wrapper.find("#operation-amount").setValue("20");
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith(
      "/operations",
      expect.objectContaining({ body: expect.objectContaining({ transferAccountId: undefined }) }),
    );
  });

  it("filters category/payment-method choices to the selected type", async () => {
    const wrapper = mountForm();
    expect(wrapper.text()).toContain("Food");
    expect(wrapper.text()).not.toContain("Salary");

    await wrapper.find("#operation-type-credit").setValue(true);
    expect(wrapper.text()).toContain("Salary");
    expect(wrapper.text()).not.toContain("Food");

    await wrapper.find("#operation-type-debit").setValue(true);
    expect(wrapper.text()).toContain("Food");
    expect(wrapper.text()).not.toContain("Salary");
  });

  it("groups categories with children under their parent's name", () => {
    const CATEGORY_GROCERIES = "00000000-0000-7000-8000-000000000103";
    const wrapper = mount(OperationForm, {
      ...withGlobalPlugins(),
      props: {
        accountId: ACCOUNT_CHECKING,
        categories: [
          ...categories,
          { id: CATEGORY_GROCERIES, parentId: CATEGORY_FOOD, type: "debit", name: "Groceries" },
        ],
        paymentMethods,
        accounts,
        banks,
      },
    });

    const group = wrapper.find("optgroup");
    expect(group.attributes("label")).toBe("Food");
    expect(group.findAll("option")).toHaveLength(2);
    expect(group.text()).toContain("Groceries");
  });

  it("shows an error toast and doesn't emit saved when submission fails", async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(400, undefined, { message: "Bad request" }));
    const wrapper = mountForm();
    await wrapper.find("#operation-third-party").setValue("Landlord");
    await wrapper.find("#operation-amount").setValue("50");
    await wrapper.find("#operation-payment-method").setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
    await submitAndSettle(wrapper);

    expect(useToast().toasts[0]?.text).toBe("Bad request");
    expect(wrapper.emitted("saved")).toBeUndefined();
  });

  it("falls back to a generic error toast when submission fails without a message", async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(500));
    const wrapper = mountForm();
    await wrapper.find("#operation-third-party").setValue("Landlord");
    await wrapper.find("#operation-amount").setValue("50");
    await wrapper.find("#operation-payment-method").setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
    await submitAndSettle(wrapper);

    expect(useToast().toasts[0]?.text).toBe("Something went wrong. Please try again.");
  });

  it("submits the value date, notes, and reconciled fields once filled in", async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200));
    const wrapper = mountForm();
    await wrapper.find("#operation-third-party").setValue("Landlord");
    await wrapper.find("#operation-amount").setValue("50");
    await wrapper.find("#operation-payment-method").setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
    await wrapper.find("#operation-value-date").setValue("2026-02-01");
    await wrapper.find("#operation-notes").setValue("Paid in cash");
    await wrapper.find("#operation-reconciled").setValue(true);
    await submitAndSettle(wrapper);

    expect(apiClient.POST).toHaveBeenCalledWith(
      "/operations",
      expect.objectContaining({
        body: expect.objectContaining({
          valueDate: "2026-02-01",
          notes: "Paid in cash",
          reconciled: true,
        }),
      }),
    );
  });

  it("emits cancel when the cancel button is clicked", async () => {
    const wrapper = mountForm();
    await wrapper.find("button.btn-outline-secondary").trigger("click");
    expect(wrapper.emitted("cancel")).toHaveLength(1);
  });

  it("focuses the amount field once a third-party autocomplete suggestion is picked", async () => {
    vi.useFakeTimers();
    apiClient.GET.mockResolvedValue(
      jsonResult(200, [{ thirdParty: "Landlord", categoryId: CATEGORY_FOOD }]),
    );
    const wrapper = mountForm({ attachTo: document.body });
    const thirdParty = wrapper.find("#operation-third-party");
    await thirdParty.setValue("Landlord");
    await nextTick();
    await vi.advanceTimersByTimeAsync(300);
    vi.useRealTimers();

    await thirdParty.trigger("change");
    await flushPromises();
    await nextTick();

    expect(document.activeElement).toBe(wrapper.find("#operation-amount").element);
    wrapper.unmount();
  });
});

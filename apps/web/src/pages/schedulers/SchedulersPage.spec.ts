import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import { asMockedApiClient, mockApiClient } from "../../test-support/mockApiClient";
import { submitAndSettle } from "../../test-support/submitAndSettle";
import { withGlobalPlugins } from "../../test-support/withGlobalPlugins";

vi.mock("../../api/client", () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from "../../api/client";
import { useConfirm } from "../../composables/useConfirm";
import type { Account, Bank } from "../accounts/accounts.types";
import { PAYMENT_METHOD_ID } from "../operations/operations.types";
import type { Category, PaymentMethod } from "../operations/operations.types";
import SchedulersPage from "./SchedulersPage.vue";
import type { Scheduler } from "./schedulers.types";

const apiClient = asMockedApiClient(realApiClient);

const ACCOUNT_ID = "00000000-0000-7000-8000-000000000401";
const CATEGORY_FOOD = "00000000-0000-7000-8000-000000000301";

// "schedulers" carries meta.requiresAuth on the real route table — a
// dedicated guard-free stub avoids the real guard redirecting every push to
// sign-in (see the AccountsPage/OperationsPage specs for the same reasoning).
function createTestRouter(): Router {
  const stub = { template: "<div />" };
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/accounts/:accountId/schedulers", name: "schedulers", component: stub }],
  });
}

const account: Account = {
  id: ACCOUNT_ID,
  bankId: "b1",
  name: "Checking",
  currency: "USD",
  closed: false,
  deleted: false,
};
const bank: Bank = { id: "b1", name: "Chase", closed: false, deleted: false };
const category: Category = { id: CATEGORY_FOOD, parentId: null, type: "debit", name: "Food" };
const paymentMethod: PaymentMethod = {
  id: PAYMENT_METHOD_ID.CHECK_DEBIT,
  name: "Check",
  type: "debit",
};

function scheduler(overrides: Partial<Scheduler> = {}): Scheduler {
  return {
    id: "s1",
    accountId: ACCOUNT_ID,
    transferAccountId: null,
    categoryId: CATEGORY_FOOD,
    paymentMethodId: PAYMENT_METHOD_ID.CHECK_DEBIT,
    thirdParty: "Landlord",
    debit: 500000,
    credit: null,
    valueDate: "2026-01-15",
    reconciled: false,
    notes: "",
    limitDate: null,
    frequencyUnit: "month",
    frequencyValue: 1,
    active: true,
    ...overrides,
  };
}

interface SchedulerList {
  items: Scheduler[];
  total: number;
  page: number;
  pageSize: number;
}

interface MockState {
  accounts?: Account[];
  banks?: Bank[];
  categories?: Category[];
  paymentMethods?: PaymentMethod[];
  schedulers?: SchedulerList;
}

function mockGet(state: MockState = {}) {
  const {
    accounts = [account],
    banks = [bank],
    categories = [category],
    paymentMethods = [paymentMethod],
    schedulers = { items: [], total: 0, page: 1, pageSize: 20 },
  } = state;
  apiClient.GET.mockImplementation(async (path: string) => {
    const ok = (data: unknown) => ({ data, error: undefined, response: new Response() });
    if (path === "/accounts") return ok(accounts);
    if (path === "/banks") return ok(banks);
    if (path === "/reference-data/categories") return ok(categories);
    if (path === "/reference-data/payment-methods") return ok(paymentMethods);
    if (path === "/schedulers") return ok(schedulers);
    return ok(undefined);
  });
}

let router: Router;
let wrapper: VueWrapper | undefined;

describe("SchedulersPage", () => {
  beforeEach(async () => {
    router = createTestRouter();
    await router.push({ name: "schedulers", params: { accountId: ACCOUNT_ID } });
    apiClient.GET.mockReset();
    apiClient.POST.mockReset();
    mockGet();
    const { state, settle } = useConfirm();
    settle(false);
    state.visible = false;
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it("shows the account name in the header and offers Add scheduler for a fully active account", async () => {
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();
    expect(wrapper.find("h1").text()).toContain("Checking");
    expect(wrapper.find("button.btn-primary").exists()).toBe(true);
  });

  it("hides Add scheduler for a closed account", async () => {
    mockGet({ accounts: [{ ...account, closed: true }] });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();
    expect(wrapper.find("button.btn-primary").exists()).toBe(false);
  });

  it("shows the empty state when there are no schedulers", async () => {
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();
    expect(wrapper.text()).toContain("No scheduled operations yet.");
  });

  it("lists schedulers with an active/paused icon and signed, formatted amounts", async () => {
    mockGet({
      schedulers: {
        items: [
          scheduler({ id: "s1", active: true, debit: 500000 }),
          scheduler({
            id: "s2",
            active: false,
            debit: null,
            credit: 250000,
            frequencyValue: 2,
            frequencyUnit: "week",
          }),
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      },
    });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    const rows = wrapper.findAll('[data-testid="scheduler-row"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].text()).toContain("▶");
    expect(rows[0].text()).toContain("-$50.00");
    expect(rows[1].text()).toContain("⏸");
    expect(rows[1].text()).toContain("+$25.00");
    expect(rows[1].text()).toContain("week(s)");
  });

  it("opens the edit form when a row is clicked", async () => {
    mockGet({ schedulers: { items: [scheduler()], total: 1, page: 1, pageSize: 20 } });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('[data-testid="scheduler-row"]').trigger("click");
    expect(wrapper.find("#scheduler-third-party").exists()).toBe(true);
  });

  it("paginates: Previous/Next are bounded, and Next re-queries the next page", async () => {
    mockGet({ schedulers: { items: [scheduler()], total: 45, page: 1, pageSize: 20 } });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    expect(wrapper.text()).toContain("Page 1 of 3");
    const [prev, next] = wrapper.findAll("nav button");
    expect(prev.attributes("disabled")).toBeDefined();
    expect(next.attributes("disabled")).toBeUndefined();

    await next.trigger("click");
    await flushPromises();

    expect(apiClient.GET).toHaveBeenCalledWith("/schedulers", {
      params: { query: { accountId: ACCOUNT_ID, page: "2" } },
    });

    await prev.trigger("click");
    await flushPromises();

    expect(apiClient.GET).toHaveBeenCalledWith("/schedulers", {
      params: { query: { accountId: ACCOUNT_ID, page: "1" } },
    });
  });

  it("resets to page 1 when navigating to a different account", async () => {
    const ACCOUNT_ID_2 = "00000000-0000-7000-8000-000000000402";
    mockGet({ schedulers: { items: [scheduler()], total: 45, page: 1, pageSize: 20 } });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    const [, next] = wrapper.findAll("nav button");
    await next.trigger("click");
    await flushPromises();
    expect(apiClient.GET).toHaveBeenCalledWith("/schedulers", {
      params: { query: { accountId: ACCOUNT_ID, page: "2" } },
    });

    await router.push({ name: "schedulers", params: { accountId: ACCOUNT_ID_2 } });
    await flushPromises();

    expect(apiClient.GET).toHaveBeenCalledWith("/schedulers", {
      params: { query: { accountId: ACCOUNT_ID_2, page: "1" } },
    });
  });

  it("shows batch actions once rows are selected, and reloads after a batch delete", async () => {
    mockGet({ schedulers: { items: [scheduler()], total: 1, page: 1, pageSize: 20 } });
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find('[data-testid="scheduler-row"] input[type="checkbox"]').setValue(true);
    expect(wrapper.find('[data-testid="scheduler-batch-actions"]').exists()).toBe(true);

    const getCallsBefore = apiClient.GET.mock.calls.length;
    await wrapper.find('[data-testid="scheduler-batch-delete"]').trigger("click");
    useConfirm().settle(true);
    await flushPromises();

    expect(apiClient.GET.mock.calls.length).toBeGreaterThan(getCallsBefore);
  });

  it("creates a scheduler and closes the form on save", async () => {
    apiClient.POST.mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 200 }),
    });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find("button.btn-primary").trigger("click");
    expect(wrapper.find("#scheduler-third-party").exists()).toBe(true);

    await wrapper.find("#scheduler-third-party").setValue("Landlord");
    await wrapper.find("#scheduler-amount").setValue("50");
    await wrapper.find("#scheduler-payment-method").setValue(PAYMENT_METHOD_ID.CHECK_DEBIT);
    await submitAndSettle(wrapper);

    expect(wrapper.find("#scheduler-third-party").exists()).toBe(false);
  });

  it("cancels the create form without saving", async () => {
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    await wrapper.find("button.btn-primary").trigger("click");
    expect(wrapper.find("#scheduler-third-party").exists()).toBe(true);

    await wrapper.find("button.btn-outline-secondary").trigger("click");
    expect(wrapper.find("#scheduler-third-party").exists()).toBe(false);
    expect(apiClient.POST).not.toHaveBeenCalled();
  });

  it("hides batch actions again once every row is deselected", async () => {
    mockGet({ schedulers: { items: [scheduler()], total: 1, page: 1, pageSize: 20 } });
    wrapper = mount(SchedulersPage, withGlobalPlugins(router));
    await flushPromises();

    const checkbox = wrapper.find('[data-testid="scheduler-row"] input[type="checkbox"]');
    await checkbox.setValue(true);
    expect(wrapper.find('[data-testid="scheduler-batch-actions"]').exists()).toBe(true);

    await checkbox.setValue(false);
    expect(wrapper.find('[data-testid="scheduler-batch-actions"]').exists()).toBe(false);
  });
});

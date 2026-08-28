import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import DashboardPage from "./DashboardPage.vue";

vi.mock("../../api/client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn() },
}));

vi.mock("../../stores/session.store", () => ({
  useSessionStore: () => ({ clear: vi.fn(), member: { email: "member@example.com" } }),
}));

const routes = [
  { path: "/", name: "home", component: DashboardPage },
  { path: "/accounts", name: "accounts", component: { template: "<div />" } },
  { path: "/reports", name: "reports", component: { template: "<div />" } },
  { path: "/settings/profile", name: "settings-profile", component: { template: "<div />" } },
  { path: "/operations/:accountId", name: "operations", component: { template: "<div />" } },
];

async function mountPage() {
  const router = createRouter({ history: createMemoryHistory(), routes });
  router.push("/");
  await router.isReady();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return mount(DashboardPage, {
    global: { plugins: [router, i18n, [VueQueryPlugin, { queryClient }]] },
  });
}

function jsonResponse<T>(data: T) {
  return Promise.resolve({ data, response: { ok: true } }) as never;
}

const emptyDashboard = {
  onboarding: null,
  totalBalances: [],
  lastSalary: null,
  lastBiggestExpense: null,
  synthesisChart: { hidden: true, axisBounds: null, series: [] },
  accountsOverview: [],
  homepageReports: [],
};

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.GET).mockReset();
  });

  it("shows the no-bank onboarding tip", async () => {
    vi.mocked(apiClient.GET).mockReturnValue(
      jsonResponse({ ...emptyDashboard, onboarding: "no-bank" }),
    );

    const wrapper = await mountPage();
    await flushPromises();

    expect(wrapper.get('[data-testid="onboarding-tip"]').text()).toContain("bank");
  });

  it("shows the no-account onboarding tip", async () => {
    vi.mocked(apiClient.GET).mockReturnValue(
      jsonResponse({ ...emptyDashboard, onboarding: "no-account" }),
    );

    const wrapper = await mountPage();
    await flushPromises();

    expect(wrapper.get('[data-testid="onboarding-tip"]').text()).toContain("account");
  });

  it("hides the onboarding tip once fully set up", async () => {
    vi.mocked(apiClient.GET).mockReturnValue(jsonResponse(emptyDashboard));

    const wrapper = await mountPage();
    await flushPromises();

    expect(wrapper.find('[data-testid="onboarding-tip"]').exists()).toBe(false);
  });

  it("color-codes a positive total balance green and a negative one red", async () => {
    vi.mocked(apiClient.GET).mockReturnValue(
      jsonResponse({
        ...emptyDashboard,
        totalBalances: [
          { currency: "USD", amount: 120.5 },
          { currency: "EUR", amount: -40 },
        ],
      }),
    );

    const wrapper = await mountPage();
    await flushPromises();

    const balances = wrapper.findAll('[data-testid="total-balance"]');
    expect(balances[0].classes()).toContain("text-success");
    expect(balances[1].classes()).toContain("text-danger");
  });

  it("hides the synthesis chart section when the chart has no data", async () => {
    vi.mocked(apiClient.GET).mockReturnValue(jsonResponse(emptyDashboard));

    const wrapper = await mountPage();
    await flushPromises();

    expect(wrapper.find('[data-testid="synthesis-chart"]').exists()).toBe(false);
  });

  it("shows the synthesis chart section when the chart has data", async () => {
    vi.mocked(apiClient.GET).mockReturnValue(
      jsonResponse({
        ...emptyDashboard,
        synthesisChart: {
          hidden: false,
          axisBounds: { min: -1, max: 1 },
          series: [{ currency: "USD", points: [{ period: "2026-08-01", value: 10 }] }],
        },
      }),
    );

    const wrapper = await mountPage();
    await flushPromises();

    expect(wrapper.find('[data-testid="synthesis-chart"]').exists()).toBe(true);
  });
});

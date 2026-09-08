import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { asMockedApiClient, mockApiClient } from "../../test-support/mockApiClient";
import { withGlobalPlugins } from "../../test-support/withGlobalPlugins";

vi.mock("../../api/client", () => ({ apiClient: mockApiClient() }));

import { apiClient as realApiClient } from "../../api/client";
import SynthesisChart from "../../components/SynthesisChart.vue";
import DashboardPage from "./DashboardPage.vue";
import type { DashboardResponse } from "./dashboard.types";

const apiClient = asMockedApiClient(realApiClient);

function baseDashboard(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
  return {
    onboarding: null,
    totalBalances: [],
    lastSalary: null,
    lastBiggestExpense: null,
    synthesisChart: { hidden: true, axisBounds: null, series: [] },
    accountsOverview: [],
    homepageReports: [],
    ...overrides,
  };
}

async function mountWithDashboard(dashboard: DashboardResponse) {
  apiClient.GET.mockReset();
  apiClient.GET.mockResolvedValue({ data: dashboard, error: undefined, response: new Response() });
  const wrapper = mount(DashboardPage, withGlobalPlugins());
  await flushPromises();
  return wrapper;
}

describe("DashboardPage", () => {
  it("renders nothing before the dashboard data has loaded", () => {
    apiClient.GET.mockReset();
    apiClient.GET.mockImplementation(() => new Promise(() => {}));
    const wrapper = mount(DashboardPage, withGlobalPlugins());
    expect(wrapper.find("h1").exists()).toBe(false);
  });

  it("shows the no-bank onboarding tip and hides everything else", async () => {
    const wrapper = await mountWithDashboard(baseDashboard({ onboarding: "no-bank" }));
    expect(wrapper.find('[data-testid="onboarding-tip"]').text()).toContain(
      "Welcome to Bagheera! Now, create your first bank.",
    );
    expect(wrapper.find('[data-testid="total-balance"]').exists()).toBe(false);
  });

  it("shows the no-account onboarding tip without hiding the rest", async () => {
    const wrapper = await mountWithDashboard(
      baseDashboard({
        onboarding: "no-account",
        totalBalances: [{ currency: "USD", amount: 100 }],
      }),
    );
    expect(wrapper.find('[data-testid="onboarding-tip"]').text()).toContain(
      "Now, create an account.",
    );
    expect(wrapper.find('[data-testid="total-balance"]').exists()).toBe(true);
  });

  it("shows a colored total balance per currency", async () => {
    const wrapper = await mountWithDashboard(
      baseDashboard({
        totalBalances: [
          { currency: "USD", amount: 12345 },
          { currency: "EUR", amount: -500 },
        ],
      }),
    );
    const balances = wrapper.findAll('[data-testid="total-balance"]');
    expect(balances[0].text()).toBe("$12,345.00");
    expect(balances[0].classes()).toContain("text-success");
    expect(balances[1].text()).toBe("-€500.00");
    expect(balances[1].classes()).toContain("text-danger");
  });

  it("shows the empty-balances message when there are no accounts", async () => {
    const wrapper = await mountWithDashboard(baseDashboard());
    expect(wrapper.text()).toContain("No accounts yet.");
  });

  it("shows the last salary and biggest expense when present", async () => {
    const wrapper = await mountWithDashboard(
      baseDashboard({
        lastSalary: { amount: 2500, currency: "USD", valueDate: "2026-01-15" },
        lastBiggestExpense: { amount: 80, currency: "USD", valueDate: "2026-01-20" },
      }),
    );
    expect(wrapper.find('[data-testid="last-salary"]').text()).toContain("$2,500.00");
    expect(wrapper.find('[data-testid="last-salary"]').text()).toContain("1/15/2026");
    expect(wrapper.find('[data-testid="last-biggest-expense"]').text()).toContain("$80.00");
  });

  it("shows the synthesis chart with one series per currency, using its axis bounds", async () => {
    const wrapper = await mountWithDashboard(
      baseDashboard({
        synthesisChart: {
          hidden: false,
          axisBounds: { min: 0, max: 1000 },
          series: [{ currency: "USD", points: [{ period: "2026-01", value: 100 }] }],
        },
      }),
    );
    expect(wrapper.find('[data-testid="synthesis-chart"]').exists()).toBe(true);
    const chart = wrapper.findComponent(SynthesisChart);
    expect(chart.props("series")).toEqual([
      { label: "USD", color: "#0d6efd", points: [{ period: "2026-01", value: 100 }] },
    ]);
    expect(chart.props("axisBounds")).toEqual({ min: 0, max: 1000 });
  });

  it("hides the synthesis chart section when marked hidden", async () => {
    const wrapper = await mountWithDashboard(baseDashboard());
    expect(wrapper.find('[data-testid="synthesis-chart"]').exists()).toBe(false);
  });

  it("groups the accounts overview by bank with a cycling badge color", async () => {
    const wrapper = await mountWithDashboard(
      baseDashboard({
        accountsOverview: [
          {
            id: "b1",
            name: "Chase",
            accounts: [{ id: "a1", name: "Checking", currency: "USD", balance: 500 }],
          },
        ],
      }),
    );
    expect(wrapper.find('[data-testid="bank-badge"]').text()).toBe("Chase");
    expect(wrapper.find('[data-testid="bank-badge"]').classes()).toContain("bg-primary");
    expect(wrapper.find('[data-testid="overview-account"]').text()).toContain("Checking");
    expect(wrapper.find('[data-testid="overview-account"]').text()).toContain("$500.00");
  });

  it("shows homepage report charts when present, with debit and credit as separate series", async () => {
    const wrapper = await mountWithDashboard(
      baseDashboard({
        homepageReports: [
          {
            id: "r1",
            title: "Monthly spend",
            chart: {
              hidden: false,
              axisBounds: null,
              series: [
                {
                  currency: "USD",
                  debit: [{ period: "2026-01", value: 50 }],
                  credit: [{ period: "2026-01", value: 20 }],
                },
              ],
            },
          },
        ],
      }),
    );
    expect(wrapper.find('[data-testid="homepage-report"]').text()).toContain("Monthly spend");
    const chart = wrapper.findComponent(SynthesisChart);
    expect(chart.props("series")).toEqual([
      { label: "USD Debit", color: "#dc3545", points: [{ period: "2026-01", value: 50 }] },
      { label: "USD Credit", color: "#198754", points: [{ period: "2026-01", value: 20 }] },
    ]);
  });

  it("omits the credit series for a currency with no credit points", async () => {
    const wrapper = await mountWithDashboard(
      baseDashboard({
        homepageReports: [
          {
            id: "r1",
            title: "Monthly spend",
            chart: {
              hidden: false,
              axisBounds: null,
              series: [{ currency: "USD", debit: [{ period: "2026-01", value: 50 }], credit: [] }],
            },
          },
        ],
      }),
    );
    const chart = wrapper.findComponent(SynthesisChart);
    expect(chart.props("series")).toEqual([
      { label: "USD Debit", color: "#dc3545", points: [{ period: "2026-01", value: 50 }] },
    ]);
  });
});

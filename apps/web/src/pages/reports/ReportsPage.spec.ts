import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import ReportsPage from "./ReportsPage.vue";

vi.mock("../../api/client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}));

function jsonResponse<T>(data: T) {
  return Promise.resolve({ data, response: { ok: true } }) as never;
}

function mountPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return mount(ReportsPage, { global: { plugins: [i18n, [VueQueryPlugin, { queryClient }]] } });
}

const reports = [
  {
    id: 1,
    memberId: 1,
    type: "sum",
    title: "Monthly spend",
    homepage: false,
    valueDateStart: null,
    valueDateEnd: null,
    thirdParties: null,
    accountIds: [],
    reconciledOnly: null,
    periodGrouping: "month",
  },
];

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.GET).mockReset();
  });

  it("hides the chart when the report has no data points", async () => {
    vi.mocked(apiClient.GET).mockImplementation((path: string) => {
      if (path === "/reports") return jsonResponse(reports);
      if (path === "/accounts") return jsonResponse([]);
      if (path === "/reports/{id}/chart")
        return jsonResponse({ hidden: true, axisBounds: null, series: [] });
      return jsonResponse(undefined);
    });

    const wrapper = mountPage();
    await flushPromises();

    await wrapper.get('[data-testid="report-row"]').get("button").trigger("click");
    await flushPromises();

    expect(wrapper.find(".synthesis-chart").exists()).toBe(false);
  });

  it("shows the chart once a report with data points is viewed", async () => {
    vi.mocked(apiClient.GET).mockImplementation((path: string) => {
      if (path === "/reports") return jsonResponse(reports);
      if (path === "/accounts") return jsonResponse([]);
      if (path === "/reports/{id}/chart") {
        return jsonResponse({
          hidden: false,
          axisBounds: { min: -1, max: 1 },
          series: [{ currency: "USD", debit: [{ period: "2026-01-01", value: 5 }], credit: [] }],
        });
      }
      return jsonResponse(undefined);
    });

    const wrapper = mountPage();
    await flushPromises();

    await wrapper.get('[data-testid="report-row"]').get("button").trigger("click");
    await flushPromises();

    expect(wrapper.find(".synthesis-chart").exists()).toBe(true);
  });

  it("highlights a report row once its checkbox is checked", async () => {
    vi.mocked(apiClient.GET).mockImplementation((path: string) => {
      if (path === "/reports") return jsonResponse(reports);
      if (path === "/accounts") return jsonResponse([]);
      return jsonResponse(undefined);
    });

    const wrapper = mountPage();
    await flushPromises();

    const row = wrapper.get('[data-testid="report-row"]');
    expect(row.classes()).not.toContain("table-active");

    await row.get('[data-testid="report-checkbox"]').setValue(true);
    expect(row.classes()).toContain("table-active");
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import OperationsPage from "./OperationsPage.vue";

vi.mock("../../api/client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}));

const routes = [
  { path: "/operations/:accountId", name: "operations", component: OperationsPage },
  { path: "/schedulers/:accountId", name: "schedulers", component: { template: "<div />" } },
];

async function mountPage() {
  const router = createRouter({ history: createMemoryHistory(), routes });
  router.push("/operations/1");
  await router.isReady();
  return mount(OperationsPage, { global: { plugins: [router, i18n] } });
}

function jsonResponse<T>(data: T) {
  return Promise.resolve({ data, response: { ok: true } }) as never;
}

describe("OperationsPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.GET).mockReset();
  });

  it("highlights selected rows via batch-selection checkboxes", async () => {
    vi.mocked(apiClient.GET).mockImplementation((path: string) => {
      if (path === "/accounts") {
        return jsonResponse([
          { id: 1, bankId: 1, name: "Checking", currency: "USD", closed: false, deleted: false },
        ]);
      }
      if (path === "/reference-data/categories") return jsonResponse([]);
      if (path === "/operations/search") {
        return jsonResponse({
          items: [
            {
              id: 10,
              accountId: 1,
              schedulerId: null,
              transferOperationId: null,
              transferAccountId: null,
              categoryId: null,
              paymentMethodId: 1,
              thirdParty: "Shop",
              debit: 50000,
              credit: null,
              valueDate: "2026-01-05",
              reconciled: false,
              notes: "",
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        });
      }
      if (path === "/accounts/{id}/chart")
        return jsonResponse({ currency: "USD", axisBounds: null, points: [] });
      return jsonResponse(undefined);
    });

    const wrapper = await mountPage();
    await flushPromises();

    const row = wrapper.get('[data-testid="operation-row"]');
    expect(row.classes()).not.toContain("table-active");

    await row.get('input[type="checkbox"]').setValue(true);

    expect(row.classes()).toContain("table-active");
  });

  it("hides the synthesis chart when the account has no operations", async () => {
    vi.mocked(apiClient.GET).mockImplementation((path: string) => {
      if (path === "/accounts") {
        return jsonResponse([
          { id: 1, bankId: 1, name: "Checking", currency: "USD", closed: false, deleted: false },
        ]);
      }
      if (path === "/reference-data/categories") return jsonResponse([]);
      if (path === "/operations")
        return jsonResponse({ items: [], total: 0, page: 1, pageSize: 20 });
      if (path === "/accounts/{id}/chart")
        return jsonResponse({ currency: "USD", axisBounds: null, points: [] });
      return jsonResponse(undefined);
    });

    const wrapper = await mountPage();
    await flushPromises();

    expect(wrapper.find(".synthesis-chart").exists()).toBe(false);
  });

  it("shows the synthesis chart when the account has operations", async () => {
    vi.mocked(apiClient.GET).mockImplementation((path: string) => {
      if (path === "/accounts") {
        return jsonResponse([
          { id: 1, bankId: 1, name: "Checking", currency: "USD", closed: false, deleted: false },
        ]);
      }
      if (path === "/reference-data/categories") return jsonResponse([]);
      if (path === "/operations")
        return jsonResponse({ items: [], total: 0, page: 1, pageSize: 20 });
      if (path === "/accounts/{id}/chart") {
        return jsonResponse({
          currency: "USD",
          axisBounds: { min: -1, max: 1 },
          points: [{ period: "2026-01-01", value: 5 }],
        });
      }
      return jsonResponse(undefined);
    });

    const wrapper = await mountPage();
    await flushPromises();

    expect(wrapper.find(".synthesis-chart").exists()).toBe(true);
  });

  it("runs a search and displays the filtered results", async () => {
    vi.mocked(apiClient.GET).mockImplementation((path: string) => {
      if (path === "/accounts") {
        return jsonResponse([
          { id: 1, bankId: 1, name: "Checking", currency: "USD", closed: false, deleted: false },
        ]);
      }
      if (path === "/reference-data/categories") return jsonResponse([]);
      if (path === "/operations/search")
        return jsonResponse({ items: [], total: 0, page: 1, pageSize: 20 });
      if (path === "/accounts/{id}/chart")
        return jsonResponse({ currency: "USD", axisBounds: null, points: [] });
      return jsonResponse(undefined);
    });
    vi.mocked(apiClient.POST).mockImplementation((path: string) => {
      if (path === "/operations/search") {
        return jsonResponse({
          items: [
            {
              id: 11,
              accountId: 1,
              schedulerId: null,
              transferOperationId: null,
              transferAccountId: null,
              categoryId: null,
              paymentMethodId: 1,
              thirdParty: "Coffee",
              debit: 5000,
              credit: null,
              valueDate: "2026-01-06",
              reconciled: false,
              notes: "",
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        });
      }
      return jsonResponse(undefined);
    });

    const wrapper = await mountPage();
    await flushPromises();

    await wrapper.get('[data-testid="toggle-search"]').trigger("click");
    expect(wrapper.find('[data-testid="search-form"]').exists()).toBe(true);

    await wrapper.get('[data-testid="search-form"]').trigger("submit");
    await flushPromises();

    expect(apiClient.POST).toHaveBeenCalledWith(
      "/operations/search",
      expect.objectContaining({ body: expect.objectContaining({ accountId: 1 }) }),
    );
    expect(wrapper.text()).toContain("Coffee");
  });

  it("gates batch delete behind the confirmation modal", async () => {
    vi.mocked(apiClient.GET).mockImplementation((path: string) => {
      if (path === "/accounts") {
        return jsonResponse([
          { id: 1, bankId: 1, name: "Checking", currency: "USD", closed: false, deleted: false },
        ]);
      }
      if (path === "/reference-data/categories") return jsonResponse([]);
      if (path === "/operations/search") {
        return jsonResponse({
          items: [
            {
              id: 10,
              accountId: 1,
              schedulerId: null,
              transferOperationId: null,
              transferAccountId: null,
              categoryId: null,
              paymentMethodId: 1,
              thirdParty: "Shop",
              debit: 50000,
              credit: null,
              valueDate: "2026-01-05",
              reconciled: false,
              notes: "",
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        });
      }
      if (path === "/accounts/{id}/chart")
        return jsonResponse({ currency: "USD", axisBounds: null, points: [] });
      return jsonResponse(undefined);
    });
    vi.mocked(apiClient.POST).mockImplementation(() =>
      jsonResponse({ message: "Operations deleted", deletedCount: 1 }),
    );

    const wrapper = await mountPage();
    await flushPromises();

    await wrapper.get('[data-testid="operation-row"] input[type="checkbox"]').setValue(true);

    const deleteButton = wrapper.get('[data-testid="batch-delete"]');
    expect(deleteButton.attributes("disabled")).toBeUndefined();
    await deleteButton.trigger("click");
    await flushPromises();

    expect(apiClient.POST).not.toHaveBeenCalledWith("/operations/batch/delete", expect.anything());
  });
});

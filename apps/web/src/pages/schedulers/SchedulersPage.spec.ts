import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { i18n } from "../../i18n";
import { apiClient } from "../../api/client";
import SchedulersPage from "./SchedulersPage.vue";

vi.mock("../../api/client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}));

const routes = [{ path: "/schedulers/:accountId", name: "schedulers", component: SchedulersPage }];

async function mountPage() {
  const router = createRouter({ history: createMemoryHistory(), routes });
  router.push("/schedulers/1");
  await router.isReady();
  return mount(SchedulersPage, { global: { plugins: [router, i18n] } });
}

function jsonResponse<T>(data: T) {
  return Promise.resolve({ data, response: { ok: true } }) as never;
}

describe("SchedulersPage", () => {
  beforeEach(() => {
    vi.mocked(apiClient.GET).mockReset();
  });

  it("lists scheduled operations and highlights selected rows", async () => {
    vi.mocked(apiClient.GET).mockImplementation((path: string) => {
      if (path === "/accounts") {
        return jsonResponse([{ id: 1, bankId: 1, name: "Checking", currency: "USD", closed: false, deleted: false }]);
      }
      if (path === "/reference-data/categories") return jsonResponse([]);
      if (path === "/schedulers") {
        return jsonResponse({
          items: [
            {
              id: 5,
              accountId: 1,
              transferAccountId: null,
              categoryId: null,
              paymentMethodId: 1,
              thirdParty: "Rent",
              debit: 1000000,
              credit: null,
              valueDate: "2026-01-01",
              reconciled: false,
              notes: "",
              limitDate: null,
              frequencyUnit: "month",
              frequencyValue: 1,
              active: true,
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

    const row = wrapper.get('[data-testid="scheduler-row"]');
    expect(row.text()).toContain("Rent");
    expect(row.classes()).not.toContain("table-active");

    await row.get('input[type="checkbox"]').setValue(true);
    expect(row.classes()).toContain("table-active");
  });

  it("shows the empty state when there are no scheduled operations", async () => {
    vi.mocked(apiClient.GET).mockImplementation((path: string) => {
      if (path === "/accounts") {
        return jsonResponse([{ id: 1, bankId: 1, name: "Checking", currency: "USD", closed: false, deleted: false }]);
      }
      if (path === "/reference-data/categories") return jsonResponse([]);
      if (path === "/schedulers") return jsonResponse({ items: [], total: 0, page: 1, pageSize: 20 });
      return jsonResponse(undefined);
    });

    const wrapper = await mountPage();
    await flushPromises();

    expect(wrapper.find('[data-testid="schedulers-table"]').exists()).toBe(false);
  });
});

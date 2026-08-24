import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { i18n } from "../../i18n";
import SearchPanel from "./search.vue";
import type { Category } from "./operations.types";

const categories: Category[] = [
  { id: 1, parentId: null, type: "debit", name: "Groceries", isSalaryCategory: false },
];

describe("SearchPanel", () => {
  it("emits only the fields the member filled in", async () => {
    const wrapper = mount(SearchPanel, { props: { categories }, global: { plugins: [i18n] } });

    await wrapper.get("#search-third-party").setValue("Coffee");
    await wrapper.get("#search-type-debit").setValue(true);
    await wrapper.get('[data-testid="search-form"]').trigger("submit");

    const events = wrapper.emitted("submit");
    expect(events).toHaveLength(1);
    expect(events![0][0]).toEqual({
      type: "debit",
      thirdParty: "Coffee",
      categoryIds: undefined,
      paymentMethodIds: undefined,
      amountComparators: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      notes: undefined,
      reconciled: undefined,
    });
  });

  it("builds an amount comparator once both the operator and value are set", async () => {
    const wrapper = mount(SearchPanel, { props: { categories }, global: { plugins: [i18n] } });

    await wrapper.get("#search-amount-operator-1").setValue("gte");
    await wrapper.get('input[type="number"]').setValue(10);
    await wrapper.get('[data-testid="search-form"]').trigger("submit");

    const events = wrapper.emitted("submit");
    expect(events![0][0]).toMatchObject({ amountComparators: [{ operator: "gte", value: 10 }] });
  });

  it("resets its fields and emits clear", async () => {
    const wrapper = mount(SearchPanel, { props: { categories }, global: { plugins: [i18n] } });

    await wrapper.get("#search-third-party").setValue("Coffee");
    await wrapper.find("button.btn-outline-secondary").trigger("click");

    expect(wrapper.emitted("clear")).toHaveLength(1);
    expect((wrapper.get("#search-third-party").element as HTMLInputElement).value).toBe("");
  });
});

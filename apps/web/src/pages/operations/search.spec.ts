import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { i18n } from "../../i18n";
import SearchPanel from "./search.vue";
import type { Category } from "./operations.types";

const categories: Category[] = [
  { id: 1, parentId: null, type: "debit", name: "Groceries" },
  { id: 2, parentId: null, type: "credit", name: "Salary" },
];

describe("SearchPanel", () => {
  it("only shows categories and payment methods matching the selected type — same field logic as the operation form", async () => {
    const wrapper = mount(SearchPanel, { props: { categories }, global: { plugins: [i18n] } });

    const categoryOptionsDebit = wrapper.findAll("#search-categories option").map((o) => o.text());
    expect(categoryOptionsDebit).toContain("Groceries");
    expect(categoryOptionsDebit).not.toContain("Salary");

    await wrapper.get("#search-type-credit").setValue(true);
    await wrapper.vm.$nextTick();

    const categoryOptionsCredit = wrapper.findAll("#search-categories option").map((o) => o.text());
    expect(categoryOptionsCredit).toContain("Salary");
    expect(categoryOptionsCredit).not.toContain("Groceries");
  });

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

  it("ignores the second amount row when the first is left empty", async () => {
    const wrapper = mount(SearchPanel, { props: { categories }, global: { plugins: [i18n] } });

    await wrapper.get("#search-amount-operator-2").setValue("lte");
    await wrapper.findAll('input[type="number"]')[1].setValue(20);
    await wrapper.get('[data-testid="search-form"]').trigger("submit");

    const events = wrapper.emitted("submit");
    expect(events![0][0]).toMatchObject({ amountComparators: undefined });
  });

  it("hydrates its fields from initialCriteria", async () => {
    const wrapper = mount(SearchPanel, {
      props: {
        categories,
        initialCriteria: { type: "credit", thirdParty: "Rent", reconciled: true },
      },
      global: { plugins: [i18n] },
    });

    expect((wrapper.get("#search-type-credit").element as HTMLInputElement).checked).toBe(true);
    expect((wrapper.get("#search-third-party").element as HTMLInputElement).value).toBe("Rent");
    expect((wrapper.get("#search-reconciled").element as HTMLSelectElement).value).toBe("true");
  });

  it("resets its fields and emits clear", async () => {
    const wrapper = mount(SearchPanel, { props: { categories }, global: { plugins: [i18n] } });

    await wrapper.get("#search-third-party").setValue("Coffee");
    await wrapper.find("button.btn-outline-secondary").trigger("click");

    expect(wrapper.emitted("clear")).toHaveLength(1);
    expect((wrapper.get("#search-third-party").element as HTMLInputElement).value).toBe("");
  });
});

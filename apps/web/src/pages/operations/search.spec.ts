import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { withGlobalPlugins } from "../../test-support/withGlobalPlugins";
import SearchPanel from "./search.vue";
import type { Category, PaymentMethod, SearchCriteria } from "./operations.types";

const categories: Category[] = [
  { id: "c1", parentId: null, type: "debit", name: "Food" },
  { id: "c2", parentId: null, type: "credit", name: "Salary" },
];
const paymentMethods: PaymentMethod[] = [
  { id: "p1", name: "Cash", type: "debit" },
  { id: "p2", name: "Deposit", type: "credit" },
];

function mountPanel(initialCriteria?: SearchCriteria) {
  return mount(SearchPanel, {
    ...withGlobalPlugins(),
    props: { categories, paymentMethods, initialCriteria },
  });
}

describe("SearchPanel", () => {
  it("defaults to debit with every other field empty", () => {
    const wrapper = mountPanel();
    expect((wrapper.find("#search-type-debit").element as HTMLInputElement).checked).toBe(true);
    expect((wrapper.find("#search-reconciled").element as HTMLSelectElement).value).toBe("");
  });

  it("hydrates every field from the initial criteria", () => {
    const wrapper = mountPanel({
      type: "credit",
      thirdParty: "Foo",
      categoryIds: ["c2"],
      paymentMethodIds: ["p2"],
      amountComparators: [{ operator: "lt", value: 50 }],
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      notes: "bar",
      reconciled: false,
    });
    expect((wrapper.find("#search-type-credit").element as HTMLInputElement).checked).toBe(true);
    expect((wrapper.find("#search-third-party").element as HTMLInputElement).value).toBe("Foo");
    expect((wrapper.find("#search-amount-operator-1").element as HTMLSelectElement).value).toBe(
      "lt",
    );
    expect((wrapper.find("#search-date-from").element as HTMLInputElement).value).toBe(
      "2026-01-01",
    );
    expect((wrapper.find("#search-notes").element as HTMLInputElement).value).toBe("bar");
    expect((wrapper.find("#search-reconciled").element as HTMLSelectElement).value).toBe("false");
  });

  it("builds and emits criteria on submit, trimming text and dropping empty fields", async () => {
    const wrapper = mountPanel();
    await wrapper.find("#search-third-party").setValue("  Landlord  ");
    await wrapper.find("#search-categories").setValue(["c1"]);
    await wrapper.find("#search-payment-methods").setValue(["p1"]);
    await wrapper.find("#search-amount-operator-1").setValue("gt");
    await wrapper.findAll('input[type="number"]')[0].setValue(100);
    await wrapper.find("#search-date-from").setValue("2026-01-01");
    await wrapper.find("#search-date-to").setValue("2026-01-31");
    await wrapper.find("#search-notes").setValue("  rent  ");
    await wrapper.find("#search-reconciled").setValue("true");
    await wrapper.find("form").trigger("submit");

    expect(wrapper.emitted("submit")).toEqual([
      [
        {
          type: "debit",
          thirdParty: "Landlord",
          categoryIds: ["c1"],
          paymentMethodIds: ["p1"],
          amountComparators: [{ operator: "gt", value: 100 }],
          dateFrom: "2026-01-01",
          dateTo: "2026-01-31",
          notes: "rent",
          reconciled: true,
        },
      ],
    ]);
  });

  it("groups categories with children under their parent's name", () => {
    const wrapper = mount(SearchPanel, {
      ...withGlobalPlugins(),
      props: {
        categories: [...categories, { id: "c3", parentId: "c1", type: "debit", name: "Groceries" }],
        paymentMethods,
      },
    });
    const group = wrapper.find("optgroup");
    expect(group.attributes("label")).toBe("Food");
    expect(group.text()).toContain("Groceries");
  });

  it("ignores the second amount row when the first is empty", async () => {
    const wrapper = mountPanel();
    await wrapper.find("#search-amount-operator-2").setValue("lt");
    await wrapper.find("form").trigger("submit");

    const [criteria] = wrapper.emitted("submit")![0] as [SearchCriteria];
    expect(criteria.amountComparators).toBeUndefined();
  });

  it("includes the second amount row once the first is set too", async () => {
    const wrapper = mountPanel();
    await wrapper.find("#search-amount-operator-1").setValue("gte");
    await wrapper.findAll('input[type="number"]')[0].setValue(10);
    await wrapper.find("#search-amount-operator-2").setValue("lte");
    await wrapper.findAll('input[type="number"]')[1].setValue(20);
    await wrapper.find("form").trigger("submit");

    const [criteria] = wrapper.emitted("submit")![0] as [SearchCriteria];
    expect(criteria.amountComparators).toEqual([
      { operator: "gte", value: 10 },
      { operator: "lte", value: 20 },
    ]);
  });

  it("drops a category/payment-method selection that no longer matches the type", async () => {
    const wrapper = mountPanel({ type: "debit", categoryIds: ["c1"], paymentMethodIds: ["p1"] });
    await wrapper.find("#search-type-credit").setValue(true);
    await wrapper.find("form").trigger("submit");

    const [criteria] = wrapper.emitted("submit")![0] as [SearchCriteria];
    expect(criteria.categoryIds).toBeUndefined();
    expect(criteria.paymentMethodIds).toBeUndefined();

    // And switching back to debit restores the debit-only choices.
    await wrapper.find("#search-type-debit").setValue(true);
    await wrapper.find("#search-categories").setValue(["c1"]);
    await wrapper.find("form").trigger("submit");

    const [secondCriteria] = wrapper.emitted("submit")![1] as [SearchCriteria];
    expect(secondCriteria.type).toBe("debit");
    expect(secondCriteria.categoryIds).toEqual(["c1"]);
  });

  it("resets every field and emits clear when Clear is clicked", async () => {
    const wrapper = mountPanel({ type: "credit", thirdParty: "Foo", notes: "bar" });
    await wrapper.find("button.btn-outline-secondary").trigger("click");

    expect((wrapper.find("#search-type-debit").element as HTMLInputElement).checked).toBe(true);
    expect((wrapper.find("#search-third-party").element as HTMLInputElement).value).toBe("");
    expect(wrapper.emitted("clear")).toHaveLength(1);
  });
});

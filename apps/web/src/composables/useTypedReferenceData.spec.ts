import { describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";
import type { Category } from "../pages/operations/operations.types";
import { useTypedReferenceData } from "./useTypedReferenceData";

const categories: Category[] = [
  { id: 1, parentId: null, type: "credit", name: "Salary" },
  { id: 2, parentId: null, type: "debit", name: "Food" },
];

describe("useTypedReferenceData", () => {
  it("filters categories and payment methods to the selected type, reactively", () => {
    const type = ref<"debit" | "credit">("debit");
    const { filteredCategories, filteredPaymentMethods } = useTypedReferenceData(
      type,
      () => categories,
    );

    expect(filteredCategories.value.map((c) => c.name)).toEqual(["Food"]);
    expect(filteredPaymentMethods.value.every((pm) => pm.type === "debit")).toBe(true);

    type.value = "credit";
    expect(filteredCategories.value.map((c) => c.name)).toEqual(["Salary"]);
    expect(filteredPaymentMethods.value.every((pm) => pm.type === "credit")).toBe(true);
  });

  it("groups the filtered categories", () => {
    const type = ref<"debit" | "credit">("debit");
    const { groupedCategories } = useTypedReferenceData(type, () => categories);

    expect(groupedCategories.value).toEqual([{ label: null, categories: [categories[1]] }]);
  });

  it("without clearOnMismatch, a type switch touches no external state", () => {
    const type = ref<"debit" | "credit">("debit");
    expect(() => {
      useTypedReferenceData(type, () => categories);
      type.value = "credit";
    }).not.toThrow();
  });

  describe("clearOnMismatch", () => {
    it("clears a category selection that no longer matches the new type", async () => {
      const type = ref<"debit" | "credit">("debit");
      const categoryId = ref<number | undefined>(2); // "Food", debit
      const paymentMethodId = ref<number>(1); // a debit payment method id
      useTypedReferenceData(type, () => categories, { categoryId, paymentMethodId });

      type.value = "credit";
      await nextTick();

      expect(categoryId.value).toBeUndefined();
    });

    it("clears a payment-method selection that no longer matches the new type", async () => {
      const type = ref<"debit" | "credit">("debit");
      const categoryId = ref<number | undefined>(undefined);
      const paymentMethodId = ref<number>(1); // a debit payment method id
      useTypedReferenceData(type, () => categories, { categoryId, paymentMethodId });

      type.value = "credit";
      await nextTick();

      expect(paymentMethodId.value).toBeUndefined();
    });
  });
});

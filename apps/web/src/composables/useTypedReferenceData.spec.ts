import { describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";
import type { Category, PaymentMethod } from "../pages/operations/operations.types";
import { useTypedReferenceData } from "./useTypedReferenceData";

const categories: Category[] = [
  { id: 1, parentId: null, type: "credit", name: "Salary" },
  { id: 2, parentId: null, type: "debit", name: "Food" },
];

const paymentMethods: PaymentMethod[] = [
  { id: 1, name: "Credit card", type: "debit" },
  { id: 5, name: "Check", type: "credit" },
  { id: 9, name: "Initial balance", type: null }, // system-generated, never a choice
];

describe("useTypedReferenceData", () => {
  it("filters categories and payment methods to the selected type, reactively", () => {
    const type = ref<"debit" | "credit">("debit");
    const { filteredCategories, filteredPaymentMethods } = useTypedReferenceData(
      type,
      () => categories,
      () => paymentMethods,
    );

    expect(filteredCategories.value.map((c) => c.name)).toEqual(["Food"]);
    expect(filteredPaymentMethods.value.map((pm) => pm.id)).toEqual([1]);

    type.value = "credit";
    expect(filteredCategories.value.map((c) => c.name)).toEqual(["Salary"]);
    expect(filteredPaymentMethods.value.map((pm) => pm.id)).toEqual([5]);
  });

  it("excludes a null-type payment method from either filter", () => {
    const type = ref<"debit" | "credit">("debit");
    const { filteredPaymentMethods } = useTypedReferenceData(
      type,
      () => categories,
      () => paymentMethods,
    );

    expect(filteredPaymentMethods.value.some((pm) => pm.id === 9)).toBe(false);
    type.value = "credit";
    expect(filteredPaymentMethods.value.some((pm) => pm.id === 9)).toBe(false);
  });

  it("groups the filtered categories", () => {
    const type = ref<"debit" | "credit">("debit");
    const { groupedCategories } = useTypedReferenceData(
      type,
      () => categories,
      () => paymentMethods,
    );

    expect(groupedCategories.value).toEqual([{ label: null, categories: [categories[1]] }]);
  });

  it("without clearOnMismatch, a type switch touches no external state", () => {
    const type = ref<"debit" | "credit">("debit");
    expect(() => {
      useTypedReferenceData(
        type,
        () => categories,
        () => paymentMethods,
      );
      type.value = "credit";
    }).not.toThrow();
  });

  describe("clearOnMismatch", () => {
    it("clears a category selection that no longer matches the new type", async () => {
      const type = ref<"debit" | "credit">("debit");
      const categoryId = ref<number | undefined>(2); // "Food", debit
      const paymentMethodId = ref<number>(1); // "Credit card", debit
      useTypedReferenceData(
        type,
        () => categories,
        () => paymentMethods,
        {
          categoryId,
          paymentMethodId,
        },
      );

      type.value = "credit";
      await nextTick();

      expect(categoryId.value).toBeUndefined();
    });

    it("clears a payment-method selection that no longer matches the new type", async () => {
      const type = ref<"debit" | "credit">("debit");
      const categoryId = ref<number | undefined>(undefined);
      const paymentMethodId = ref<number>(1); // "Credit card", debit
      useTypedReferenceData(
        type,
        () => categories,
        () => paymentMethods,
        {
          categoryId,
          paymentMethodId,
        },
      );

      type.value = "credit";
      await nextTick();

      expect(paymentMethodId.value).toBeUndefined();
    });
  });
});

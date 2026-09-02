import { computed, watch, type Ref } from "vue";
import {
  groupCategories,
  type Category,
  type PaymentMethod,
} from "../pages/operations/operations.types";

/**
 * Category/payment-method choices filtered to the selected debit/credit
 * type — the same field logic every operation-like form (and the search
 * panel) needs, matching the server-side type-filtered validation
 * (validateTypedRefs). A payment method with a null type (id 9, "Initial
 * balance") matches neither filter — excluded from both without needing
 * a special case, same as it always has been.
 *
 * Optionally also clears a single-select categoryId/paymentMethodId pair
 * when switching type leaves the current choice no longer valid (a still-
 * valid selection is preserved) — pass `clearOnMismatch` for a form field,
 * omit it for a multi-select consumer like the search panel, which filters
 * its own array selections down instead.
 */
export function useTypedReferenceData(
  type: Ref<"debit" | "credit">,
  categories: () => Category[],
  paymentMethods: () => PaymentMethod[],
  clearOnMismatch?: {
    categoryId: Ref<number | undefined>;
    paymentMethodId: Ref<number>;
  },
) {
  const filteredCategories = computed(() => categories().filter((c) => c.type === type.value));
  const groupedCategories = computed(() => groupCategories(filteredCategories.value));
  const filteredPaymentMethods = computed(() =>
    paymentMethods().filter((pm) => pm.type === type.value),
  );

  if (clearOnMismatch) {
    const { categoryId, paymentMethodId } = clearOnMismatch;
    watch(type, () => {
      if (!filteredCategories.value.some((c) => c.id === categoryId.value)) {
        categoryId.value = undefined;
      }
      if (!filteredPaymentMethods.value.some((pm) => pm.id === paymentMethodId.value)) {
        paymentMethodId.value = undefined as unknown as number;
      }
    });
  }

  return { filteredCategories, groupedCategories, filteredPaymentMethods };
}

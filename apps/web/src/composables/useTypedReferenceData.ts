import type { EntryType } from '@bagheera/reference-data';
import { computed, watch, type Ref } from 'vue';
import { groupCategories, type Category, type PaymentMethod } from '../domain/referenceData';

/**
 * Category/payment-method choices filtered to the debit/credit type,
 * mirroring the API's validateTypedRefs ("Initial balance", typed null,
 * matches neither). An undefined `type` ("any" — only the search panel
 * offers it) keeps every non-system choice instead of filtering.
 *
 * `clearOnMismatch` clears a form's single selections that a type switch
 * invalidates; the search panel omits it and filters its own arrays. A
 * mismatching value is cleared through its setter without validating, so a
 * type switch never shows a "required" error before a submit.
 */
export function useTypedReferenceData(
  type: Ref<EntryType | undefined>,
  categories: () => Category[],
  paymentMethods: () => PaymentMethod[],
  clearOnMismatch?: {
    categoryId: Ref<string | undefined>;
    setCategoryId: (value: string | undefined, shouldValidate: boolean) => void;
    paymentMethodId: Ref<string | undefined>;
    setPaymentMethodId: (value: string | undefined, shouldValidate: boolean) => void;
  },
) {
  const filteredCategories = computed(() =>
    type.value === undefined ? categories() : categories().filter((c) => c.type === type.value),
  );
  const groupedCategories = computed(() => groupCategories(filteredCategories.value));
  const filteredPaymentMethods = computed(() =>
    type.value === undefined
      ? paymentMethods().filter((pm) => pm.type !== null)
      : paymentMethods().filter((pm) => pm.type === type.value),
  );

  if (clearOnMismatch) {
    const { categoryId, setCategoryId, paymentMethodId, setPaymentMethodId } = clearOnMismatch;
    watch(type, () => {
      if (
        categoryId.value !== undefined &&
        !filteredCategories.value.some((c) => c.id === categoryId.value)
      ) {
        setCategoryId(undefined, false);
      }
      if (
        paymentMethodId.value !== undefined &&
        !filteredPaymentMethods.value.some((pm) => pm.id === paymentMethodId.value)
      ) {
        setPaymentMethodId(undefined, false);
      }
    });
  }

  return { filteredCategories, groupedCategories, filteredPaymentMethods };
}

import type { EntryType } from '@bagheera/reference-data';
import { computed, watch, type Ref } from 'vue';
import { groupCategories, type Category, type PaymentMethod } from '../domain/referenceData';

/**
 * Category/payment-method choices filtered to the debit/credit type,
 * mirroring the API's validateTypedRefs ("Initial balance", typed null,
 * matches neither).
 *
 * `clearOnMismatch` clears a form's single selections that a type switch
 * invalidates; the search panel omits it and filters its own arrays.
 */
export function useTypedReferenceData(
  type: Ref<EntryType>,
  categories: () => Category[],
  paymentMethods: () => PaymentMethod[],
  clearOnMismatch?: {
    categoryId: Ref<string | undefined>;
    paymentMethodId: Ref<string | undefined>;
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
        paymentMethodId.value = undefined;
      }
    });
  }

  return { filteredCategories, groupedCategories, filteredPaymentMethods };
}

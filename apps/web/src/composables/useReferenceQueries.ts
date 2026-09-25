import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { apiClient } from '../api/client';
import type { Account, Bank } from '../pages/accounts/accounts.types';
import type { Category, PaymentMethod } from '../pages/operations/operations.types';

// The query keys of the member's accounts and banks, and of the two seeded
// reference lists — one home, so a page that changes accounts or banks
// invalidates exactly what the pages reading them cached.
export const REFERENCE_QUERY_KEYS = {
  accounts: ['accounts'],
  banks: ['banks'],
  categories: ['categories'],
  paymentMethods: ['payment-methods'],
} as const;

// A list endpoint answers `undefined` on failure; treat that as an empty
// list. The `*Query` returned alongside each list is the raw query, for the
// rare caller that needs to know whether data has actually arrived.
function useListQuery<T>(
  queryKey: readonly string[],
  fetchList: () => Promise<{ data?: unknown }>,
) {
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await fetchList();
      return (data as T[] | undefined) ?? [];
    },
  });
  const list = computed(() => query.data.value ?? []);
  return { query, list };
}

export function useAccountsQuery() {
  const { query, list } = useListQuery<Account>(REFERENCE_QUERY_KEYS.accounts, () =>
    apiClient.GET('/accounts'),
  );
  return { accountsQuery: query, accounts: list };
}

export function useBanksQuery() {
  const { query, list } = useListQuery<Bank>(REFERENCE_QUERY_KEYS.banks, () =>
    apiClient.GET('/banks'),
  );
  return { banksQuery: query, banks: list };
}

export function useCategoriesQuery() {
  const { query, list } = useListQuery<Category>(REFERENCE_QUERY_KEYS.categories, () =>
    apiClient.GET('/reference-data/categories'),
  );
  return { categoriesQuery: query, categories: list };
}

export function usePaymentMethodsQuery() {
  const { query, list } = useListQuery<PaymentMethod>(REFERENCE_QUERY_KEYS.paymentMethods, () =>
    apiClient.GET('/reference-data/payment-methods'),
  );
  return { paymentMethodsQuery: query, paymentMethods: list };
}

import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import { unwrap } from '../api/unwrap';

// The `*Query` returned alongside each list is the raw query, for the rare
// caller that needs to know whether data has actually arrived or the
// request failed (`isError`).
function useListQuery<T>(
  queryKey: readonly string[],
  fetchList: () => Promise<{ data?: T[]; error?: unknown; response: Response }>,
) {
  const query = useQuery({
    queryKey,
    queryFn: async () => unwrap<T[]>(await fetchList()),
  });
  const list = computed(() => query.data.value ?? []);
  return { query, list };
}

export function useAccountsQuery() {
  const { query, list } = useListQuery(queryKeys.accounts, () => apiClient.GET('/accounts'));
  return { accountsQuery: query, accounts: list };
}

export function useBanksQuery() {
  const { query, list } = useListQuery(queryKeys.banks, () => apiClient.GET('/banks'));
  return { banksQuery: query, banks: list };
}

export function useCategoriesQuery() {
  const { query, list } = useListQuery(queryKeys.categories, () =>
    apiClient.GET('/reference-data/categories'),
  );
  return { categoriesQuery: query, categories: list };
}

export function usePaymentMethodsQuery() {
  const { query, list } = useListQuery(queryKeys.paymentMethods, () =>
    apiClient.GET('/reference-data/payment-methods'),
  );
  return { paymentMethodsQuery: query, paymentMethods: list };
}

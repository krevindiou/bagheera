import { computed, ref, watch, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../api/queryKeys';
import { unwrap } from '../api/unwrap';
import type { SearchCriteria } from '../domain/referenceData';
import { useToast } from './useToast';

const EMPTY_PAGE = { items: [], total: 0, page: 1, pageSize: 20 };

/**
 * An account's operations list, the search the server remembers for it
 * (GET /operations re-applies it; POST/DELETE /operations/search set and
 * clear it), and the search panel's state.
 *
 * "Active" is read from the cached page, not mirrored into a flag a watcher
 * could undo. The panel is restored from the remembered search once per
 * account, on its first load only: paging or a refetch never reopens it.
 */
export function useOperationSearch(accountId: Ref<string>) {
  const { t } = useI18n();
  const { push: toast } = useToast();
  const queryClient = useQueryClient();

  const page = ref(1);
  const panelOpen = ref(false);
  // What the panel's fields are hydrated with when it opens: the recalled
  // criteria on restore, or the last submitted ones after a search.
  const criteria = ref<SearchCriteria | undefined>(undefined);
  // The account whose remembered search has already been restored (or
  // superseded by one run here), so a later refetch never restores again.
  const restoredFor = ref<string | null>(null);

  watch(accountId, () => {
    page.value = 1;
    panelOpen.value = false;
    criteria.value = undefined;
  });

  const query = useQuery({
    queryKey: computed(() => queryKeys.operations.page(accountId.value, page.value)),
    queryFn: async () =>
      unwrap(
        await apiClient.GET('/operations', {
          params: { query: { accountId: accountId.value, page: page.value } },
        }),
      ),
  });

  const list = computed(() => query.data.value ?? EMPTY_PAGE);
  const isError = computed(() => query.isError.value);
  const isActive = computed(() => query.data.value?.active ?? false);

  watch(
    () => query.data.value,
    (result) => {
      if (!result || restoredFor.value === accountId.value) return;
      restoredFor.value = accountId.value;
      if (result.active) {
        criteria.value = result.criteria;
        panelOpen.value = true;
      }
    },
    { immediate: true },
  );

  const searchMutation = useMutation({
    mutationFn: async (submitted: SearchCriteria) =>
      unwrap(
        await apiClient.POST('/operations/search', {
          params: { query: { page: 1 } },
          body: { accountId: accountId.value, ...submitted },
        }),
      ),
    onSuccess(data, submitted) {
      restoredFor.value = accountId.value;
      criteria.value = submitted;
      page.value = 1;
      // The search's first page, cached as the active search it now is.
      queryClient.setQueryData(queryKeys.operations.page(accountId.value, 1), {
        ...data,
        active: true,
        criteria: submitted,
      });
      panelOpen.value = false;
    },
    onError() {
      toast(t('common.loadError'), 'error');
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      await apiClient.DELETE('/operations/search', {
        params: { query: { accountId: accountId.value } },
      });
    },
    async onSuccess() {
      page.value = 1;
      panelOpen.value = false;
      await queryClient.invalidateQueries({ queryKey: queryKeys.operations.all(accountId.value) });
    },
  });

  return {
    page,
    list,
    isError,
    isActive,
    panelOpen,
    criteria,
    openPanel: () => {
      panelOpen.value = true;
    },
    closePanel: () => {
      panelOpen.value = false;
    },
    run: (submitted: SearchCriteria) => searchMutation.mutate(submitted),
    clear: () => clearMutation.mutate(),
  };
}

import { watch, type Ref } from 'vue';

interface PagedResult {
  items: readonly unknown[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * A page past the last one (its rows just deleted, or a stale ?page=) comes
 * back empty with a positive total; step back to the last page that has rows
 * instead of showing the list as empty with no pager.
 */
export function useStepBackToLastPage(
  page: Ref<number>,
  data: () => PagedResult | undefined,
): void {
  watch(
    data,
    (result) => {
      if (!result || result.page !== page.value || page.value <= 1) return;
      if (result.items.length > 0) return;
      page.value = Math.max(1, Math.ceil(result.total / result.pageSize));
    },
    { immediate: true },
  );
}

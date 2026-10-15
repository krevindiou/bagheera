import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

// A ?page= query param that isn't a positive integer behaves like page 1.
function pageFromQuery(raw: unknown): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

/**
 * A paginated list's current page, kept in the URL's ?page= so a reload or
 * Back restores it. Paging replaces the history entry rather than pushing
 * one per page; page 1 leaves the param out.
 */
export function usePageQuery() {
  const route = useRoute();
  const router = useRouter();
  const page = ref(pageFromQuery(route.query.page));

  watch(page, (value) => {
    if (pageFromQuery(route.query.page) === value) return;
    const query = { ...route.query };
    if (value > 1) {
      query.page = String(value);
    } else {
      delete query.page;
    }
    void router.replace({ query });
  });

  return page;
}

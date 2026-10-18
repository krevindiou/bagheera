import { QueryClient } from '@tanstack/vue-query';

// Lists that mutations already invalidate (accounts, banks, ...) don't need
// a refetch on every mount; queries fed by server-side background work opt
// out with `staleTime: 0`.
export const DEFAULT_STALE_TIME_MS = 30_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: DEFAULT_STALE_TIME_MS,
    },
  },
});

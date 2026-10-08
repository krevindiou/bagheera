import type { RouteLocationNormalizedLoaded, Router } from 'vue-router';

/**
 * Reads an emailed link's one-time `?key=` and drops it from the address
 * bar at once, so it doesn't linger in history, copied URLs or error
 * reports. Null when absent or empty.
 */
export function takeUrlKey(route: RouteLocationNormalizedLoaded, router: Router): string | null {
  const raw = route.query.key;
  if (typeof raw !== 'string' || raw.length === 0) {
    return null;
  }
  const query = { ...route.query };
  delete query.key;
  void router.replace({ query });
  return raw;
}

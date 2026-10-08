import type { RouteLocationNormalizedLoaded, Router } from 'vue-router';

/**
 * Reads the one-time `?key=` token from an emailed link (sign-up, email
 * change) and drops it from the address bar straight away, so it doesn't
 * linger in the browser history, a copied URL or an error report's page URL
 * while the page waits on the member or on the API. The caller keeps the
 * returned value in memory; a reload no longer carries it, which is fine
 * for links that are single-use anyway.
 *
 * Returns null when there is no (or an empty) key.
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

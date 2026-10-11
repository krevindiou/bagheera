import { onUnmounted, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { Router } from 'vue-router';
import { i18n } from '../i18n';

// Set by the current page when it knows something more specific than its
// route's title (e.g. an account name); cleared on every navigation so a
// stale override never leaks into the next page.
const override: Ref<string | null> = ref(null);

function render(base: string | null): string {
  const brand = i18n.global.t('app.brand');
  const page = override.value ?? base;
  return page ? `${page} · ${brand}` : brand;
}

/**
 * Keeps `document.title` in sync with the active route's `meta.titleKey`,
 * refreshed after every navigation and whenever the locale changes (so a
 * language switch retitles the current page without a navigation).
 */
export function setupDocumentTitle(router: Router): void {
  function apply(): void {
    const titleKey = router.currentRoute.value.meta.titleKey;
    document.title = render(titleKey ? i18n.global.t(titleKey) : null);
  }

  router.afterEach(() => {
    override.value = null;
    apply();
  });
  watch(i18n.global.locale, apply);
  watch(override, apply);
}

/**
 * Lets the current page override the route's default title with `title`
 * while it's mounted — e.g. an account name ahead of "Operations". `null`
 * (still loading, or nothing more specific) leaves the route's title alone.
 */
export function usePageTitle(title: ComputedRef<string | null>): void {
  watch(
    title,
    (value) => {
      override.value = value;
    },
    { immediate: true },
  );
  onUnmounted(() => {
    override.value = null;
  });
}

import { createPinia, setActivePinia } from 'pinia';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import type { Plugin } from 'vue';
import type { Router } from 'vue-router';
import { i18n } from '../i18n';
import { router as appRouter } from '../router';

/**
 * Standard `global:` option for `mount()`/`shallowMount()`: a fresh Pinia
 * instance (also made active, so a store/composable called outside a
 * component — e.g. from a submit handler — still resolves correctly), the
 * real i18n catalog (never a `$t` stub, so assertions see real copy and a
 * missing translation key fails loudly), and a fresh per-test QueryClient
 * (no retries, no cache reuse across tests). Defaults to the app's real
 * router, since several pages/guards depend on actual navigation — pass a
 * different instance/route table when a test needs to isolate from it.
 */
export function withGlobalPlugins(router: Router = appRouter) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  // Typed to match @vue/test-utils' own `global.plugins` shape exactly —
  // without it, the `[VueQueryPlugin, options]` tuple entry below infers
  // too loosely (or, with `as const`, too strictly as `readonly`) to satisfy
  // MountingOptions.
  const plugins: (Plugin | [Plugin, ...unknown[]])[] = [
    pinia,
    router,
    i18n,
    [VueQueryPlugin, { queryClient }],
  ];
  return { global: { plugins } };
}

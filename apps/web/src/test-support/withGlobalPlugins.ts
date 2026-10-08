import { createPinia, setActivePinia } from 'pinia';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import type { Plugin } from 'vue';
import type { Router } from 'vue-router';
import { vAutofocus } from '../directives/autofocus';
import { i18n } from '../i18n';
import { router as appRouter } from '../router';

/**
 * The standard `global:` mount option: a fresh, active Pinia, the real
 * i18n catalog (so missing keys show), a fresh QueryClient without retries
 * and the app's router unless another is passed. Also returns that
 * `queryClient`, for specs asserting on invalidation.
 */
export function withGlobalPlugins(router: Router = appRouter) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  // Typed explicitly: the tuple entry otherwise infers too loosely (or, with
  // `as const`, as `readonly`) for MountingOptions.
  const plugins: (Plugin | [Plugin, ...unknown[]])[] = [
    pinia,
    router,
    i18n,
    [VueQueryPlugin, { queryClient }],
  ];
  return { global: { plugins, directives: { autofocus: vAutofocus } }, queryClient };
}

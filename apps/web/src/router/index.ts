import {
  createRouter,
  createWebHistory,
  type RouteLocationRaw,
  type RouteRecordRaw,
} from 'vue-router';
import { setLocale } from '../i18n';
import { detectLocale, isSupportedLocale, SUPPORTED_LOCALES } from '../i18n/locales';
import { useSessionStore } from '../stores/session.store';

// Every path lives under `/:locale`, constrained to SUPPORTED_LOCALES so an
// unsupported value falls through to the catch-all.
const localePattern = SUPPORTED_LOCALES.join('|');

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: () => `/${detectLocale()}/sign-in` },
  {
    path: `/:locale(${localePattern})`,
    children: [
      {
        path: 'sign-in',
        name: 'sign-in',
        component: () => import('../pages/auth/SignInPage.vue'),
      },
      {
        path: 'register',
        name: 'register',
        component: () => import('../pages/auth/RegisterPage.vue'),
      },
      {
        path: 'activate',
        name: 'activate',
        component: () => import('../pages/auth/ActivatePage.vue'),
      },
      {
        path: 'confirm-email-change',
        name: 'confirm-email-change',
        component: () => import('../pages/auth/ConfirmEmailChangePage.vue'),
      },
      {
        path: 'home',
        name: 'home',
        component: () => import('../pages/dashboard/DashboardPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'accounts',
        name: 'accounts',
        component: () => import('../pages/accounts/AccountsPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'accounts/:accountId/operations',
        name: 'operations',
        component: () => import('../pages/operations/OperationsPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'accounts/:accountId/schedulers',
        name: 'schedulers',
        component: () => import('../pages/schedulers/SchedulersPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'reports',
        name: 'reports',
        component: () => import('../pages/reports/ReportsPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'settings/profile',
        name: 'settings-profile',
        component: () => import('../pages/settings/ProfilePage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'settings/passkeys',
        name: 'settings-passkeys',
        component: () => import('../pages/settings/PasskeysPage.vue'),
        meta: { requiresAuth: true },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: () => `/${detectLocale()}/sign-in` },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Call sites navigate by name only, so `push`/`replace`/`resolve` fill in
// the current (or detected) locale when a target omits it; an explicit
// `params.locale` (the language switcher) is left alone.
function withLocale(to: RouteLocationRaw): RouteLocationRaw {
  if (typeof to === 'string' || !('name' in to) || !to.name) {
    return to;
  }
  if (to.params && 'locale' in to.params) {
    return to;
  }
  const current = router.currentRoute.value.params.locale;
  const locale = isSupportedLocale(current) ? current : detectLocale();
  return { ...to, params: { ...to.params, locale } };
}

const rawPush = router.push.bind(router);
const rawReplace = router.replace.bind(router);
const rawResolve = router.resolve.bind(router);
router.push = (to: RouteLocationRaw) => rawPush(withLocale(to));
router.replace = (to: RouteLocationRaw) => rawReplace(withLocale(to));
router.resolve = (to: RouteLocationRaw, currentLocation?: never) =>
  rawResolve(withLocale(to), currentLocation);

router.beforeEach(async (to) => {
  const locale = to.params.locale;
  if (typeof locale === 'string' && isSupportedLocale(locale)) {
    await setLocale(locale);
  }

  if (!to.meta.requiresAuth) {
    return true;
  }
  // No active Pinia counts as signed out.
  let store: ReturnType<typeof useSessionStore>;
  try {
    store = useSessionStore();
  } catch {
    return { name: 'sign-in' };
  }
  // After a reload, wait to learn whether the session cookie is still valid.
  if (!store.restored) {
    await store.restore();
  }
  // The target's locale, not withLocale's current-route fallback.
  return store.isAuthenticated ? true : { name: 'sign-in', params: { locale } };
});

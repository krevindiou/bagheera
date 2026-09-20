import {
  createRouter,
  createWebHistory,
  type RouteLocationRaw,
  type RouteRecordRaw,
} from 'vue-router';
import { setLocale } from '../i18n';
import { detectLocale, isSupportedLocale, SUPPORTED_LOCALES } from '../i18n/locales';
import { useSessionStore } from '../stores/session.store';

// Every path lives under a `/:locale` segment, constrained to
// SUPPORTED_LOCALES (see i18n/locales.ts — the source of truth this regex
// is built from) so an unsupported value falls through to the catch-all
// below instead of matching. Sibling per-locale trees (`/en/...`,
// `/fr/...`) rather than a locale-agnostic path, matching this app's
// original intent (see the comment this replaced in i18n/index.ts).
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

// Every call site in this app navigates by name only — `router.push({
// name: 'home' })`, `<router-link :to="{ name: 'accounts' }">` — same as
// before this app had a locale segment at all. Requiring each of those
// ~20 call sites to instead thread `params: { locale }` through by hand
// would be easy to miss (a silent "missing param" navigation failure) and
// hard to review for completeness, so it's done once here instead:
// `push`/`replace`/`resolve` are wrapped to fill in the current route's
// locale (or a freshly detected one, if there isn't a current route yet)
// whenever a target omits it. A caller that does pass `params.locale`
// explicitly — the language switcher — is left alone.
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
router.push = ((to: RouteLocationRaw) => rawPush(withLocale(to))) as typeof router.push;
router.replace = ((to: RouteLocationRaw) => rawReplace(withLocale(to))) as typeof router.replace;
router.resolve = ((to: RouteLocationRaw, currentLocation?: never) =>
  rawResolve(withLocale(to), currentLocation)) as typeof router.resolve;

router.beforeEach(async (to) => {
  // `to.params.locale` is always a supported value here — the `(en|fr)`
  // regex on the route path itself is what makes an unsupported segment
  // fail to match this branch and fall through to the catch-all instead.
  const locale = to.params.locale;
  if (typeof locale === 'string' && isSupportedLocale(locale)) {
    await setLocale(locale);
  }

  if (!to.meta.requiresAuth) {
    return true;
  }
  // No active Pinia (e.g. a bare navigation in a test) is treated the
  // same as "not signed in" — the safe default is to bounce to sign-in.
  let store: ReturnType<typeof useSessionStore>;
  try {
    store = useSessionStore();
  } catch {
    return { name: 'sign-in' };
  }
  // On a fresh page load the store hasn't yet learned whether the session
  // cookie is still valid — wait for that check before deciding, so a
  // refresh doesn't bounce an actually-signed-in member to sign-in.
  if (!store.restored) {
    await store.restore();
  }
  // `to.params.locale` (not the wrapped push()'s default-filling) — the
  // caller of this guard already resolved a concrete route with a locale
  // segment, so redirecting on auth failure keeps the visitor in it rather
  // than possibly switching languages via withLocale's own current-route
  // fallback.
  return store.isAuthenticated ? true : { name: 'sign-in', params: { locale } };
});

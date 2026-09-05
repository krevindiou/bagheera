import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useSessionStore } from "../stores/session.store";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/en/sign-in" },
  {
    path: "/en",
    children: [
      {
        path: "sign-in",
        name: "sign-in",
        component: () => import("../pages/auth/SignInPage.vue"),
      },
      {
        path: "register",
        name: "register",
        component: () => import("../pages/auth/RegisterPage.vue"),
      },
      {
        path: "activate",
        name: "activate",
        component: () => import("../pages/auth/ActivatePage.vue"),
      },
      {
        path: "forgot-password",
        name: "forgot-password",
        component: () => import("../pages/auth/ForgotPasswordPage.vue"),
      },
      {
        path: "reset-password",
        name: "reset-password",
        component: () => import("../pages/auth/ResetPasswordPage.vue"),
      },
      {
        path: "confirm-email-change",
        name: "confirm-email-change",
        component: () => import("../pages/auth/ConfirmEmailChangePage.vue"),
      },
      {
        path: "home",
        name: "home",
        component: () => import("../pages/dashboard/DashboardPage.vue"),
        meta: { requiresAuth: true },
      },
      {
        path: "accounts",
        name: "accounts",
        component: () => import("../pages/accounts/AccountsPage.vue"),
        meta: { requiresAuth: true },
      },
      {
        path: "accounts/:accountId/operations",
        name: "operations",
        component: () => import("../pages/operations/OperationsPage.vue"),
        meta: { requiresAuth: true },
      },
      {
        path: "accounts/:accountId/schedulers",
        name: "schedulers",
        component: () => import("../pages/schedulers/SchedulersPage.vue"),
        meta: { requiresAuth: true },
      },
      {
        path: "reports",
        name: "reports",
        component: () => import("../pages/reports/ReportsPage.vue"),
        meta: { requiresAuth: true },
      },
      {
        path: "settings/profile",
        name: "settings-profile",
        component: () => import("../pages/settings/ProfilePage.vue"),
        meta: { requiresAuth: true },
      },
      {
        path: "settings/password",
        name: "settings-password",
        component: () => import("../pages/settings/PasswordPage.vue"),
        meta: { requiresAuth: true },
      },
      {
        path: "settings/passkeys",
        name: "settings-passkeys",
        component: () => import("../pages/settings/PasskeysPage.vue"),
        meta: { requiresAuth: true },
      },
    ],
  },
  { path: "/:pathMatch(.*)*", redirect: "/en/sign-in" },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) {
    return true;
  }
  // No active Pinia (e.g. a bare navigation in a test) is treated the
  // same as "not signed in" — the safe default is to bounce to sign-in.
  let store: ReturnType<typeof useSessionStore>;
  try {
    store = useSessionStore();
  } catch {
    return { name: "sign-in" };
  }
  // On a fresh page load the store hasn't yet learned whether the session
  // cookie is still valid — wait for that check before deciding, so a
  // refresh doesn't bounce an actually-signed-in member to sign-in.
  if (!store.restored) {
    await store.restore();
  }
  return store.isAuthenticated ? true : { name: "sign-in" };
});

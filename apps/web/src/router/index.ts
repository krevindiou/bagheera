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
        path: "home",
        name: "home",
        component: () => import("../pages/HomePage.vue"),
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
    ],
  },
  { path: "/:pathMatch(.*)*", redirect: "/en/sign-in" },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  if (!to.meta.requiresAuth) {
    return true;
  }
  // No active Pinia (e.g. a bare navigation in a test) is treated the
  // same as "not signed in" — the safe default is to bounce to sign-in.
  let authenticated = false;
  try {
    authenticated = useSessionStore().isAuthenticated;
  } catch {
    authenticated = false;
  }
  return authenticated ? true : { name: "sign-in" };
});

import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

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
      },
    ],
  },
  { path: "/:pathMatch(.*)*", redirect: "/en/sign-in" },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

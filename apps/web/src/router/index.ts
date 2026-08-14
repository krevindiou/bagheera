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
    ],
  },
  { path: "/:pathMatch(.*)*", redirect: "/en/sign-in" },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

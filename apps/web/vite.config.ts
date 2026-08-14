/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// API route prefixes, proxied to the API dev server so cookies stay
// same-origin during local (non-Docker) development.
const apiRoutePrefixes = [
  "/accounts",
  "/auth",
  "/banks",
  "/dashboard",
  "/health",
  "/members",
  "/operations",
  "/reference-data",
  "/reports",
  "/schedulers",
];

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: Object.fromEntries(
      apiRoutePrefixes.map((prefix) => [
        prefix,
        {
          target: "http://localhost:3000",
          changeOrigin: true,
          // The API's session/CSRF cookies are Secure-only and only get
          // set when the request looks like it arrived over HTTPS (it
          // trusts this header from its immediate proxy — Caddy in
          // production, this dev proxy locally). Without it, sign-in
          // silently never persists a session outside of production.
          headers: { "X-Forwarded-Proto": "https" },
        },
      ]),
    ),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    // e2e/ holds Playwright specs (run via `pnpm e2e`), not Vitest ones.
    exclude: ["**/node_modules/**", "e2e/**"],
  },
});

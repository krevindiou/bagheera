/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Target for the API dev-server proxy below. Defaults to localhost for
// native (non-Docker) dev; docker-compose.yml overrides it to the api
// service's container-network address ("http://api:3000").
const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://localhost:3000";

// API route prefixes, proxied to the API dev server so cookies stay
// same-origin during local development.
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
    host: true,
    proxy: Object.fromEntries(
      apiRoutePrefixes.map((prefix) => [
        prefix,
        {
          target: apiProxyTarget,
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

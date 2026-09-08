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
  "/webauthn",
];

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    // packages/money is a pnpm workspace symlink, so Vite's dep crawler
    // treats it as source and serves its dist/index.js untransformed —
    // but that file is tsc's CommonJS output (`exports.foo = ...`), which
    // isn't valid syntax for a browser loading it as a native ES module.
    // Forcing it through esbuild's pre-bundling step (like any regular
    // node_modules dep) converts it to real ESM first.
    include: ["@bagheera/money"],
  },
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
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      // Branches only, not lines/statements/functions — branch is the one
      // metric that can't be satisfied by a line merely running once (it
      // needs both sides of a conditional exercised), so it's the one worth
      // gating on. Set as a floor a bit under current (~90.5%), to catch a
      // real regression without flaking on normal variance — not a target
      // to ratchet upward for its own sake.
      thresholds: { branches: 90 },
    },
  },
});

import { defineConfig, devices } from "@playwright/test";

// docker/compose.yml's `playwright` service shares the `web` container's
// network namespace specifically so this resolves to a genuine localhost
// origin (see that file's long comment) — required both for the
// Secure-flagged session/CSRF cookies to be stored at all, and for
// fixtures.ts's `page.request` calls to land on the exact same origin a
// browser navigation would, through Vite's dev-server API proxy.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // Every spec shares one Postgres/Valkey pair *and* one source IP for the
  // whole run (this container) — rate-limiting is keyed off IP+identifier
  // (apps/api/src/security/rate-limit.*), so a wrong-password/lockout
  // assertion running concurrently with anything else hitting
  // /auth/sign-in would trip shared limiter state unpredictably. See the
  // plan's "Execution model" section for the full rationale.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // Without CI set, process.env.CI is empty and this stays list-only —
  // matching docker/compose.yml's playwright service, which only forwards
  // a real CI=true from an actual CI run, not from a plain local
  // `make test-e2e`.
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

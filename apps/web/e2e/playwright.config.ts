import { defineConfig, devices } from "@playwright/test";

// Runs against an already-running stack (`make e2e`) rather than
// spinning up its own infra — see docker/compose.e2e.yml and
// the Makefile's `e2e` target for prerequisites (seeded DB, short
// SESSION_IDLE_TTL_SECONDS for idle-timeout.spec.ts, etc). Run this
// against your regular long-lived dev stack instead and that one test
// will fail — it needs the short TTL to exercise a real expiry.
process.env.E2E_BASE_URL ??= "http://localhost:5173";
process.env.E2E_MAILPIT_HTTP_URL ??= "http://localhost:8025";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { outputFolder: "../playwright-report", open: "never" }]]
    : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

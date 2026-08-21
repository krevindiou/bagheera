import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  globalSetup: "./support/global-setup.ts",
  globalTeardown: "./support/global-teardown.ts",
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { outputFolder: "../playwright-report", open: "never" }]]
    : "list",
  use: {
    // Fixed port the harness always starts the web dev server on (see
    // support/infra.ts) — known before globalSetup runs, unlike
    // E2E_BASE_URL which globalSetup only sets once containers are up.
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

import { defineConfig, devices } from '@playwright/test';

// A real localhost origin (the `playwright` service shares the `web`
// container's network, see docker/compose.yml): needed for the Secure
// cookies, and so `page.request` hits the same origin as the browser.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // One database and one source IP for the whole run: concurrent specs
  // would trip each other's rate limits.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // CI=true is only forwarded from a real CI run.
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

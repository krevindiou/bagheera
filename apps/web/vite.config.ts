/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// docker/compose.yml sets it to "http://api:3000".
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

// Proxied so cookies stay same-origin in dev: /api, plus the bare /health.
const apiRoutePrefixes = ['/health', '/api'];

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    // Workspace symlinks would be served as-is, but their dist/ is
    // CommonJS: pre-bundling converts it to ESM for the browser.
    include: ['@bagheera/money', '@bagheera/reference-data'],
  },
  server: {
    host: true,
    proxy: Object.fromEntries(
      apiRoutePrefixes.map((prefix) => [
        prefix,
        {
          target: apiProxyTarget,
          changeOrigin: true,
          // The API only sets its Secure cookies on an HTTPS request, read
          // from this header (set by kamal-proxy in production).
          headers: { 'X-Forwarded-Proto': 'https' },
        },
      ]),
    ),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // e2e/ holds Playwright specs (run via `pnpm e2e`), not Vitest ones.
    exclude: ['**/node_modules/**', 'e2e/**'],
    reporters: ['default', 'junit'],
    outputFile: { junit: './junit-unit.xml' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      // Branches only: a line merely running once can't satisfy it. A floor
      // just under the ~90.5% measured, not a target.
      thresholds: { branches: 90 },
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      // Branches only — same convention as apps/web's vite.config.ts and
      // apps/api's jest coverageThreshold.
      thresholds: { branches: 90 },
    },
  },
});

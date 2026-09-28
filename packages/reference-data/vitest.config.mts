import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    reporters: ['default', 'junit'],
    outputFile: { junit: './junit-unit.xml' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      // Branches only — same convention as apps/web's vite.config.ts and
      // apps/api's vitest.config.mts coverageThreshold.
      thresholds: { branches: 90 },
    },
  },
});

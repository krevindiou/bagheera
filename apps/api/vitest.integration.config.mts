import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Integration tests (`pnpm test:integration`) against one shared
// Testcontainers Postgres/Valkey (test/integration-infra.ts), so files run
// one at a time.
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: { transform: { legacyDecorator: true, decoratorMetadata: true } },
    }),
  ],
  test: {
    root: './src',
    include: ['**/*.integration-spec.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    setupFiles: ['dotenv/config', '../test/reset-rate-limits.ts'],
    globalSetup: ['../test/integration-global-setup.ts'],
    pool: 'forks',
    fileParallelism: false,
    // Keep files isolated (~3x slower): with `isolate: false`,
    // webauthn-registration's vi.mock('@simplewebauthn/server') leaks into
    // other files.
    reporters: ['default', 'junit'],
    outputFile: { junit: '../junit-integration.xml' },
    coverage: {
      provider: 'v8',
      // Not `../coverage`: the two runs cover disjoint files, and sharing
      // a directory would let the second overwrite the first.
      reportsDirectory: '../coverage-integration',
      reporter: ['text', 'lcov', 'json-summary'],
      // The services/controllers unit coverage leaves out.
      all: true,
      include: ['**/*.service.ts', '**/*.controller.ts'],
      exclude: ['**/coverage/**', '**/test-support/**'],
      // Just under the 83.7% measured when added. Raise it to track real
      // gains; never lower it to silence a dip.
      thresholds: { branches: 83 },
    },
  },
});

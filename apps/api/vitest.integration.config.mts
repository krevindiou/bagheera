import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Integration-test runner (`pnpm test:integration`) — real Postgres/Valkey
// via Testcontainers (test/integration-infra.ts), booted once for the
// whole run by globalSetup. Every spec shares that one instance and the
// api container's host Docker socket mount, so they can't run concurrently
// — fileParallelism: false mirrors Jest's --runInBand.
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
    // `isolate: false` (sharing one worker's module graph across files)
    // looked tempting for speed, but webauthn-registration.integration-spec
    // 's module-level vi.mock('@simplewebauthn/server', ...) then leaks
    // into every other file sharing that worker, wrongly mocking the
    // library everywhere else too — two failures traced directly to it.
    // Keep the default (isolated) at the cost of ~3x the wall time.
    reporters: ['default', 'junit'],
    outputFile: { junit: '../junit-integration.xml' },
    coverage: {
      provider: 'v8',
      // Separate from the unit config's `../coverage` — these two runs
      // measure disjoint file sets (unit: everything except
      // services/controllers; this: only services/controllers), so
      // sharing a directory would have whichever runs second silently
      // discard the other's report instead of the two being additive.
      reportsDirectory: '../coverage-integration',
      reporter: ['text', 'lcov', 'json-summary'],
      // The inverse of the unit config's `allExcept` scope: unit coverage
      // excludes every *.service.ts/*.controller.ts (mocked-DB tests can't
      // meaningfully exercise them — see vitest.config.mts's own comment),
      // so this is the only place that measures them, against a real
      // Postgres/Valkey.
      all: true,
      include: ['**/*.service.ts', '**/*.controller.ts'],
      exclude: ['**/coverage/**', '**/test-support/**'],
      // Measured at 83.7% branches the day this was added — a small
      // buffer under that, so ordinary noise doesn't fail CI but a real
      // drop in service/controller coverage does. Move it only to track a
      // genuine, reviewed change in coverage, not to silence a dip.
      thresholds: { branches: 83 },
    },
  },
});

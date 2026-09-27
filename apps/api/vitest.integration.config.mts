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
  },
});

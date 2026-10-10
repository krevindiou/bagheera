import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const SRC = join(import.meta.dirname, 'src');

function allSrcFiles(): string[] {
  return readdirSync(SRC, { recursive: true, encoding: 'utf-8' })
    .map((entry) => entry.split('\\').join('/'))
    .filter((rel) => /\.(ts|js)$/.test(rel));
}

/**
 * Every source file ending in `suffix`, minus `keep` (paths relative to
 * `src`). Vitest's include/exclude can't express "this category except
 * these files": a `!` entry in `exclude` zeroes the whole report, and
 * `include` doesn't override `exclude`.
 */
function allExcept(suffix: string, keep: string[]): string[] {
  const keepSet = new Set(keep);
  return allSrcFiles().filter((rel) => rel.endsWith(suffix) && !keepSet.has(rel));
}

// The services and controllers whose coverage the unit report keeps; the
// integration report (vitest.integration.config.mts) leaves them out.
export const UNIT_COVERED_SERVICES_AND_CONTROLLERS = [
  'health/health.controller.ts',
  'security/crypto.service.ts',
  'session/session-rotation.service.ts',
];

// Unit tests (integration specs: vitest.integration.config.mts).
// decoratorMetadata is what Nest's DI reads for constructor param types.
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: { transform: { legacyDecorator: true, decoratorMetadata: true } },
    }),
  ],
  test: {
    root: './src',
    include: ['**/*.spec.ts'],
    environment: 'node',
    globals: true,
    reporters: ['default', 'junit'],
    outputFile: { junit: '../junit-unit.xml' },
    coverage: {
      provider: 'v8',
      reportsDirectory: '../coverage',
      reporter: ['text', 'lcov', 'json-summary'],
      all: true,
      // Controllers and services are left to integration coverage, except
      // the files kept below.
      include: ['**/*.ts', '**/*.js'],
      exclude: [
        '**/*.integration-spec.ts',
        // A stray src/coverage/ report would otherwise count as app code.
        '**/coverage/**',
        '**/test-support/**',
        '**/*.module.ts',
        ...allExcept('.controller.ts', UNIT_COVERED_SERVICES_AND_CONTROLLERS),
        ...allExcept('.service.ts', UNIT_COVERED_SERVICES_AND_CONTROLLERS),
        '**/db/schema/**',
        ...allExcept('.provider.ts', ['email/smtp-email.provider.ts']),
        'main.ts',
        'db/db.constants.ts',
        'db/migrate.ts',
        'db/seed.ts',
        'logging/sentry.ts',
        'session/session-data.ts',
        'session/webauthn-session-data.ts',
        'session/session.constants.ts',
        'common/money.ts',
        'common/currency.ts',
        'common/value-date.ts',
        'common/parse-uuid-v7.pipe.ts',
      ],
      thresholds: { branches: 97 },
    },
  },
});

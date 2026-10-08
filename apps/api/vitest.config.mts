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
      // Controllers, services and email/** are left to integration
      // coverage, except the files kept below.
      include: ['**/*.ts', '**/*.js'],
      exclude: [
        '**/*.integration-spec.ts',
        // A stray src/coverage/ report would otherwise count as app code.
        '**/coverage/**',
        '**/test-support/**',
        '**/*.module.ts',
        ...allExcept('.controller.ts', ['health/health.controller.ts']),
        ...allExcept('.service.ts', ['security/crypto.service.ts', 'security/hash.service.ts']),
        ...allSrcFiles().filter((rel) => rel.startsWith('email/') && rel !== 'email/i18n/en.ts'),
        '**/db/schema/**',
        '**/*.provider.ts',
        'main.ts',
        'db/db.constants.ts',
        'db/seed.ts',
        '**/db/test-utils/**',
        'logging/sentry.ts',
        'session/session-data.ts',
        'session/webauthn-session-data.ts',
        'session/session.constants.ts',
        'members/send-activation-email.ts',
        'common/money.ts',
        'common/currency.ts',
        'common/parse-uuid-v7.pipe.ts',
      ],
      thresholds: { branches: 97 },
    },
  },
});

import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// Spike config (tech-debt.md #9, phase 1) — SWC replaces both ts-jest and
// the esm-to-cjs-transform.cjs Babel shim. emitDecoratorMetadata (tsconfig
// "decoratorMetadata" below) is what Nest's DI reads to resolve
// constructor param types; that's the one real unknown this spike checks.
export default defineConfig({
  plugins: [
    tsconfigPaths(),
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
  },
});

// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: {
          // Files outside src/ (excluded from tsconfig.json's "include" so
          // `nest build` doesn't try to emit them under rootDir) still need
          // a project to type-check against for lint.
          allowDefaultProject: ['drizzle.config.ts', 'test/*.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'drizzle-orm',
              importNames: ['ilike'],
              message:
                "Don't build ILIKE conditions by hand — a raw term needs escaping. Use ilikeContains() from '../common/like-pattern' instead.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/common/like-pattern.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
);

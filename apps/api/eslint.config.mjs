// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Decorator names read off a class or method node (e.g. `@Post('x')` or
// `@SkipRateLimit()`) — covers both the CallExpression form (`@Foo(...)`)
// and the bare-identifier form (`@Foo`), which is all this codebase uses.
function decoratorNames(node) {
  return (node?.decorators ?? [])
    .map((d) => {
      const expr = d.expression;
      if (expr.type === 'CallExpression' && expr.callee.type === 'Identifier') {
        return expr.callee.name;
      }
      if (expr.type === 'Identifier') {
        return expr.name;
      }
      return null;
    })
    .filter((name) => name !== null);
}

const MUTATING_HTTP_DECORATORS = new Set(['Post', 'Put', 'Patch', 'Delete']);

// Every *.controller.ts mutating handler (@Post/@Put/@Patch/@Delete) must
// carry @RateLimit(...) or @SkipRateLimit(), on the method or its class, so
// a forgotten rate-limit decision fails the build.
const requireRateLimitDecisionRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Mutating controller handlers must declare @RateLimit(...) or @SkipRateLimit().',
    },
    schema: [],
    messages: {
      missing:
        'Mutating handler "{{name}}" has neither @RateLimit(...) nor @SkipRateLimit() (on itself or its controller class). Add @RateLimit(...) if this route should be throttled, or @SkipRateLimit() with a comment explaining why not.',
    },
  },
  create(context) {
    return {
      MethodDefinition(node) {
        const methodDecorators = decoratorNames(node);
        if (![...methodDecorators].some((n) => MUTATING_HTTP_DECORATORS.has(n))) {
          return;
        }
        if (
          methodDecorators.includes('RateLimit') ||
          methodDecorators.includes('SkipRateLimit')
        ) {
          return;
        }
        const classNode = node.parent?.parent;
        const classDecorators = decoratorNames(classNode);
        if (
          classDecorators.includes('RateLimit') ||
          classDecorators.includes('SkipRateLimit')
        ) {
          return;
        }
        context.report({
          node,
          messageId: 'missing',
          data: { name: node.key?.name ?? '<unknown>' },
        });
      },
    };
  },
};

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
        ...globals.vitest,
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
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
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
  {
    files: ['src/**/*.controller.ts'],
    plugins: {
      local: { rules: { 'require-rate-limit-decision': requireRateLimitDecisionRule } },
    },
    rules: {
      'local/require-rate-limit-decision': 'error',
    },
  },
);

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

export default {
  meta: { name: 'local' },
  rules: { 'require-rate-limit-decision': requireRateLimitDecisionRule },
};

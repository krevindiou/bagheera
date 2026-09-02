import { operation } from '../db/schema';
import { ilikeContains } from './like-pattern';

// ilikeContains builds `sql`${column} ilike ${term}``, and drizzle's `sql`
// tag pushes a plain string param straight into queryChunks (no Param
// wrapper) — the term is the only string-typed chunk in the tree.
function paramValue(condition: ReturnType<typeof ilikeContains>): unknown {
  const param = condition.queryChunks.find(
    (chunk): chunk is string => typeof chunk === 'string',
  );
  if (param === undefined) {
    throw new Error('expected a string param in the generated SQL, found none');
  }
  return param;
}

describe('ilikeContains', () => {
  it('wraps the term in %...% wildcards', () => {
    expect(paramValue(ilikeContains(operation.thirdParty, 'acme'))).toBe(
      '%acme%',
    );
  });

  it('escapes a literal % so it matches itself, not the ILIKE wildcard', () => {
    expect(paramValue(ilikeContains(operation.thirdParty, '50%'))).toBe(
      '%50\\%%',
    );
  });

  it('escapes a literal _ so it matches itself, not the single-char wildcard', () => {
    expect(paramValue(ilikeContains(operation.thirdParty, 'a_b'))).toBe(
      '%a\\_b%',
    );
  });

  it('escapes a literal backslash before escaping % and _, so escaping is not doubled', () => {
    expect(paramValue(ilikeContains(operation.thirdParty, 'a\\b'))).toBe(
      '%a\\\\b%',
    );
    expect(paramValue(ilikeContains(operation.thirdParty, '\\%'))).toBe(
      '%\\\\\\%%',
    );
  });

  it('leaves a term with no special characters untouched, just wrapped', () => {
    expect(paramValue(ilikeContains(operation.thirdParty, 'plain term'))).toBe(
      '%plain term%',
    );
  });
});

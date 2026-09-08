import { ilikeContains } from './like-pattern';

// The point of this module is the escaping it does before ever calling
// drizzle's own `ilike()` — asserting on the pattern string `ilike` is
// called with is more direct and less brittle than trying to unpack the
// `SQL` chunk object real drizzle-orm returns. `ilike` is referenced only
// through jest.requireMock (a runtime call, not a static import) since
// importing it by name is banned everywhere but like-pattern.ts itself —
// see eslint.config.mjs's no-restricted-imports.
//
// jest.requireActual/requireMock are untyped (return `any`) — the
// eslint-disables below are that, and only that: no unsafe use, just a
// weakly-typed jest API.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
jest.mock('drizzle-orm', () => {
  const actual = jest.requireActual('drizzle-orm');
  return { ...actual, ilike: jest.fn(actual.ilike) };
});
const { ilike }: { ilike: jest.Mock } = jest.requireMock('drizzle-orm');
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */

describe('ilikeContains', () => {
  // Opaque stand-in for a real drizzle column — ilikeContains never reads
  // it, only forwards it to the (mocked) `ilike()`.
  const column = { name: 'third_party' } as never;

  it('wraps a plain term in % wildcards', () => {
    ilikeContains(column, 'foo');
    expect(ilike).toHaveBeenCalledWith(column, '%foo%');
  });

  it('escapes a literal backslash', () => {
    ilikeContains(column, 'a\\b');
    expect(ilike).toHaveBeenCalledWith(column, '%a\\\\b%');
  });

  it('escapes a literal % wildcard so it matches itself', () => {
    ilikeContains(column, '50%');
    expect(ilike).toHaveBeenCalledWith(column, '%50\\%%');
  });

  it('escapes a literal _ wildcard so it matches itself', () => {
    ilikeContains(column, 'a_b');
    expect(ilike).toHaveBeenCalledWith(column, '%a\\_b%');
  });

  it('escapes backslashes before %/_, so their own escaping backslashes are not doubled', () => {
    ilikeContains(column, '%_');
    expect(ilike).toHaveBeenCalledWith(column, '%\\%\\_%');
  });
});

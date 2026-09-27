// The point of this module is the escaping it does before ever calling
// drizzle's own `ilike()` — asserting on the pattern string `ilike` is
// called with is more direct and less brittle than trying to unpack the
// `SQL` chunk object real drizzle-orm returns. Importing `ilike` by name
// is banned everywhere but like-pattern.ts itself (see eslint.config.mjs's
// no-restricted-imports) — the eslint-disable below is that ban, lifted
// only to reach the mocked export for assertions.
// eslint-disable-next-line no-restricted-imports
import { ilike } from 'drizzle-orm';
import { vi } from 'vitest';
import { ilikeContains } from './like-pattern';

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return { ...actual, ilike: vi.fn(actual.ilike) };
});

describe('ilikeContains', () => {
  // Opaque stand-in for a real drizzle column — ilikeContains never reads
  // it, only forwards it to the (mocked) `ilike()`.
  const column = { name: 'third_party' } as never;

  it('wraps a plain term in % wildcards', () => {
    ilikeContains(column, 'foo');
    expect(vi.mocked(ilike)).toHaveBeenCalledWith(column, '%foo%');
  });

  it('escapes a literal backslash', () => {
    ilikeContains(column, 'a\\b');
    expect(vi.mocked(ilike)).toHaveBeenCalledWith(column, '%a\\\\b%');
  });

  it('escapes a literal % wildcard so it matches itself', () => {
    ilikeContains(column, '50%');
    expect(vi.mocked(ilike)).toHaveBeenCalledWith(column, '%50\\%%');
  });

  it('escapes a literal _ wildcard so it matches itself', () => {
    ilikeContains(column, 'a_b');
    expect(vi.mocked(ilike)).toHaveBeenCalledWith(column, '%a\\_b%');
  });

  it('escapes backslashes before %/_, so their own escaping backslashes are not doubled', () => {
    ilikeContains(column, '%_');
    expect(vi.mocked(ilike)).toHaveBeenCalledWith(column, '%\\%\\_%');
  });
});

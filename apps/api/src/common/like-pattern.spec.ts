// Asserts on the pattern passed to a mocked `ilike()` rather than unpacking
// drizzle's SQL chunks. The import ban is lifted only to reach that mock.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { ilike } from 'drizzle-orm';
import { vi } from 'vitest';
import { ilikeContains } from './like-pattern';

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return { ...actual, ilike: vi.fn(actual.ilike) };
});

describe('ilikeContains', () => {
  // Only forwarded to `ilike()`, never read.
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

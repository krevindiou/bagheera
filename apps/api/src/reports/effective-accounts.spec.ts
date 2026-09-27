import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { effectiveAccounts } from './effective-accounts';
import { vi } from 'vitest';

// Both query shapes effectiveAccounts issues end in a terminal `.where(...)`,
// reached through either `.from().where()` or `.from().innerJoin()...where()`
// — a self-returning chain covers both without caring which path was taken.
function chain(result: unknown[]) {
  const query = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn().mockResolvedValue(result),
  };
  query.from.mockReturnValue(query);
  query.innerJoin.mockReturnValue(query);
  return query;
}

function fakeDb(rawLinks: { accountId: string }[], accounts: { id: string; currency: string }[]) {
  const select = vi.fn().mockReturnValueOnce(chain(rawLinks)).mockReturnValueOnce(chain(accounts));
  return { select } as unknown as NodePgDatabase;
}

describe('effectiveAccounts', () => {
  it('falls back to every eligible account when the report has no linked accounts', async () => {
    const accounts = [{ id: 'account-1', currency: 'EUR' }];
    const db = fakeDb([], accounts);
    const result = await effectiveAccounts(db, 'report-1', 'member-1');
    expect(result).toEqual(accounts);
  });

  it("uses only the report's linked accounts when at least one link row exists", async () => {
    const accounts = [{ id: 'account-2', currency: 'USD' }];
    const db = fakeDb([{ accountId: 'account-2' }], accounts);
    const result = await effectiveAccounts(db, 'report-1', 'member-1');
    expect(result).toEqual(accounts);
  });
});

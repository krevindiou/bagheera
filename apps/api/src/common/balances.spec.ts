import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { balancesByAccount, ZERO_BALANCE } from './balances';

function dbReturning(rows: unknown[]) {
  const groupBy = jest.fn().mockResolvedValue(rows);
  const db = {
    select: jest.fn().mockReturnValue({
      from: () => ({ where: () => ({ groupBy }) }),
    }),
  };
  return { db: db as unknown as NodePgDatabase, select: db.select };
}

describe('balancesByAccount', () => {
  it('skips the query when there are no accounts', async () => {
    const { db, select } = dbReturning([]);
    expect(await balancesByAccount(db, [])).toEqual(new Map());
    expect(select).not.toHaveBeenCalled();
  });

  it('subtracts debits from credits, for all and for reconciled operations', async () => {
    const { db } = dbReturning([
      {
        accountId: 'a1',
        credit: '50000',
        debit: '20000',
        reconciledCredit: '30000',
        reconciledDebit: '5000',
      },
    ]);
    const balances = await balancesByAccount(db, ['a1', 'a2']);
    expect(balances.get('a1')).toEqual({ balance: 30000, reconciledBalance: 25000 });
    expect(balances.get('a2')).toBeUndefined();
  });

  it('exposes a zero balance for accounts without operations', () => {
    expect(ZERO_BALANCE).toEqual({ balance: 0, reconciledBalance: 0 });
  });
});

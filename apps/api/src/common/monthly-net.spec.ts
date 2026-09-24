import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { MinorUnits } from './money';
import { monthlyNetByAccount, toSynthesisChartRow } from './monthly-net';

describe('monthlyNetByAccount', () => {
  it("doesn't query at all for no accounts", async () => {
    const select = jest.fn();
    const db = { select } as unknown as NodePgDatabase;
    await expect(monthlyNetByAccount(db, [])).resolves.toEqual([]);
    expect(select).not.toHaveBeenCalled();
  });

  // Postgres returns sum() over bigint as a numeric string.
  it("turns each row's summed net into a number", async () => {
    const groupBy = jest
      .fn()
      .mockResolvedValue([{ accountId: 'a1', month: '2025-01-01', net: '-200000' }]);
    const db = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({ groupBy }),
        }),
      }),
    } as unknown as NodePgDatabase;

    await expect(monthlyNetByAccount(db, ['a1'])).resolves.toEqual([
      { accountId: 'a1', month: '2025-01-01', net: -200000 },
    ]);
  });
});

describe('toSynthesisChartRow', () => {
  it('carries a positive or zero net as a credit', () => {
    expect(
      toSynthesisChartRow({ accountId: 'a1', month: '2025-01-01', net: 500 as MinorUnits }, 'EUR'),
    ).toEqual({ currency: 'EUR', credit: 500, debit: null, valueDate: '2025-01-01' });
    expect(
      toSynthesisChartRow({ accountId: 'a1', month: '2025-01-01', net: 0 as MinorUnits }, 'EUR'),
    ).toEqual({ currency: 'EUR', credit: 0, debit: null, valueDate: '2025-01-01' });
  });

  it('carries a negative net as a debit of its size', () => {
    expect(
      toSynthesisChartRow({ accountId: 'a1', month: '2025-02-01', net: -300 as MinorUnits }, 'USD'),
    ).toEqual({ currency: 'USD', credit: null, debit: 300, valueDate: '2025-02-01' });
  });
});

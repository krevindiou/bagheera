import {
  categorySeeds,
  PAYMENT_METHOD_ID,
  paymentMethodSeeds,
  SALARY_CATEGORY_SEED_ID,
} from './seed-data';

describe('paymentMethodSeeds', () => {
  it('has exactly the 9 fixed payment methods', () => {
    expect(paymentMethodSeeds).toHaveLength(9);
    expect(paymentMethodSeeds).toEqual([
      { id: PAYMENT_METHOD_ID.CREDIT_CARD, name: 'Credit card', type: 'debit' },
      { id: PAYMENT_METHOD_ID.CHECK_DEBIT, name: 'Check', type: 'debit' },
      {
        id: PAYMENT_METHOD_ID.CASH_WITHDRAWAL,
        name: 'Cash withdrawal',
        type: 'debit',
      },
      {
        id: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
        name: 'Transfer',
        type: 'debit',
      },
      { id: PAYMENT_METHOD_ID.CHECK_CREDIT, name: 'Check', type: 'credit' },
      {
        id: PAYMENT_METHOD_ID.TRANSFER_CREDIT,
        name: 'Transfer',
        type: 'credit',
      },
      { id: PAYMENT_METHOD_ID.DEPOSIT, name: 'Deposit', type: 'credit' },
      {
        id: PAYMENT_METHOD_ID.DIRECT_DEBIT,
        name: 'Direct debit',
        type: 'debit',
      },
      {
        id: PAYMENT_METHOD_ID.INITIAL_BALANCE,
        name: 'Initial balance',
        type: null,
      },
    ]);
  });

  it('ids are unique and names stay within the 16-char column limit', () => {
    const ids = paymentMethodSeeds.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const method of paymentMethodSeeds) {
      expect(method.name.length).toBeLessThanOrEqual(16);
    }
  });
});

describe('categorySeeds', () => {
  const flatten = (
    seeds: typeof categorySeeds,
  ): (typeof categorySeeds)[number][] =>
    seeds.flatMap((s) => [s, ...flatten(s.children ?? [])]);

  it('seeds "Salary" first with the fixed id matched by SALARY_CATEGORY_ID', () => {
    const matches = flatten(categorySeeds).filter((c) => c.name === 'Salary');
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      type: 'credit',
      id: SALARY_CATEGORY_SEED_ID,
    });
    expect(categorySeeds[0].name).toBe('Salary');
  });

  it('only Salary has a fixed id — the rest get a DB-generated one', () => {
    const others = flatten(categorySeeds).filter((c) => c.name !== 'Salary');
    for (const category of others) {
      expect(category.id).toBeUndefined();
    }
  });

  it('keeps names within the 32-char column limit and uses only two levels', () => {
    for (const top of categorySeeds) {
      expect(top.name.length).toBeLessThanOrEqual(32);
      for (const child of top.children ?? []) {
        expect(child.name.length).toBeLessThanOrEqual(32);
        expect(child.children).toBeUndefined();
      }
    }
  });
});

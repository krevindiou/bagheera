import { categorySeeds, paymentMethodSeeds } from './seed-data';

describe('paymentMethodSeeds', () => {
  it('has exactly the 9 fixed payment methods', () => {
    expect(paymentMethodSeeds).toHaveLength(9);
    expect(paymentMethodSeeds).toEqual([
      { id: 1, name: 'Credit card', type: 'debit' },
      { id: 2, name: 'Check', type: 'debit' },
      { id: 3, name: 'Cash withdrawal', type: 'debit' },
      { id: 4, name: 'Transfer', type: 'debit' },
      { id: 5, name: 'Check', type: 'credit' },
      { id: 6, name: 'Transfer', type: 'credit' },
      { id: 7, name: 'Deposit', type: 'credit' },
      { id: 8, name: 'Direct debit', type: 'debit' },
      { id: 9, name: 'Initial balance', type: null },
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

  it('flags exactly one category as the salary category', () => {
    const flagged = flatten(categorySeeds).filter((c) => c.isSalaryCategory);
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toMatchObject({ name: 'Salary', type: 'credit' });
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

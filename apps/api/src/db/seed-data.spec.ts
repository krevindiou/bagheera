import { FIELD_LIMITS } from '@bagheera/reference-data';
import { categorySeeds, CategorySeed, PAYMENT_METHOD_ID, paymentMethodSeeds } from './seed-data';

// The version/variant nibbles IsUUID('7') checks.
const UUID_V7_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function flattenCategories(seeds: CategorySeed[]): CategorySeed[] {
  return seeds.flatMap((seed) => [seed, ...flattenCategories(seed.children ?? [])]);
}

describe('paymentMethodSeeds', () => {
  it('has exactly one seed per PAYMENT_METHOD_ID entry', () => {
    const seedIds = new Set(paymentMethodSeeds.map((s) => s.id));
    expect(seedIds.size).toBe(paymentMethodSeeds.length); // no duplicate ids
    expect(seedIds).toEqual(new Set(Object.values(PAYMENT_METHOD_ID)));
  });

  it('every id is a structurally valid UUIDv7', () => {
    for (const seed of paymentMethodSeeds) {
      expect(seed.id).toMatch(UUID_V7_SHAPE);
    }
  });

  it('every type is debit, credit, or null', () => {
    for (const seed of paymentMethodSeeds) {
      expect(['debit', 'credit', null]).toContain(seed.type);
    }
  });

  it('only INITIAL_BALANCE is untyped — every other payment method is pinned debit or credit', () => {
    const untyped = paymentMethodSeeds.filter((s) => s.type === null);
    expect(untyped.map((s) => s.id)).toEqual([PAYMENT_METHOD_ID.INITIAL_BALANCE]);
  });

  it('pins the Transfer debit/credit pair — transfer.service.ts keys off these exact ids', () => {
    expect(PAYMENT_METHOD_ID.TRANSFER_DEBIT).toBe('00000000-0000-7000-8000-000000000004');
    expect(PAYMENT_METHOD_ID.TRANSFER_CREDIT).toBe('00000000-0000-7000-8000-000000000006');
  });
});

describe('categorySeeds', () => {
  it('every category, top-level or nested, has a debit or credit type', () => {
    for (const category of flattenCategories(categorySeeds)) {
      expect(['debit', 'credit']).toContain(category.type);
    }
  });

  it('fits the category.name column and never repeats a name under the same parent', () => {
    const seen = new Set<string>();
    const walk = (seeds: CategorySeed[], parent: string) => {
      for (const seed of seeds) {
        expect(seed.name.length).toBeLessThanOrEqual(32);
        const key = `${parent}/${seed.name}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
        walk(seed.children ?? [], key);
      }
    };
    walk(categorySeeds, '');
  });

  it('keeps sub-categories one level deep and of their parent type', () => {
    for (const parent of categorySeeds) {
      for (const child of parent.children ?? []) {
        expect(child.type).toBe(parent.type);
        expect(child.children).toBeUndefined();
      }
    }
  });

  describe('granularity', () => {
    const topLevel = (type: 'debit' | 'credit') => categorySeeds.filter((c) => c.type === type);
    const names = flattenCategories(categorySeeds).map((c) => c.name);
    const childCount = (name: string) =>
      categorySeeds.find((c) => c.name === name)?.children?.length ?? 0;

    it('has at least 18 top-level debit and 8 top-level credit categories', () => {
      expect(topLevel('debit').length).toBeGreaterThanOrEqual(18);
      expect(topLevel('credit').length).toBeGreaterThanOrEqual(8);
    });

    it.each(['Housing', 'Food', 'Transport'])(
      'splits %s into at least 3 sub-categories',
      (name) => {
        expect(childCount(name)).toBeGreaterThanOrEqual(3);
      },
    );

    it.each([
      'Groceries',
      'Restaurants',
      'Insurance',
      'Taxes',
      'Subscriptions',
      'Savings',
      'Children',
    ])('has a category named %s or starting with it', (word) => {
      expect(names.some((n) => n === word || n.startsWith(word))).toBe(true);
    });

    it('stays within the report and search category selection cap', () => {
      expect(flattenCategories(categorySeeds).length).toBeLessThanOrEqual(
        FIELD_LIMITS.CATEGORY_SELECTION,
      );
    });
  });
});

import {
  categorySeeds,
  CategorySeed,
  PAYMENT_METHOD_ID,
  paymentMethodSeeds,
  SALARY_CATEGORY_SEED_ID,
} from './seed-data';

// class-validator isn't pulled in here — this only checks the version/variant
// nibbles the app actually relies on (IsUUID('7') elsewhere checks the same
// shape), via a plain regex rather than adding a test dependency on it.
const UUID_V7_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function flattenCategories(seeds: CategorySeed[]): CategorySeed[] {
  return seeds.flatMap((seed) => [
    seed,
    ...flattenCategories(seed.children ?? []),
  ]);
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
    expect(untyped.map((s) => s.id)).toEqual([
      PAYMENT_METHOD_ID.INITIAL_BALANCE,
    ]);
  });

  it('pins the Transfer debit/credit pair — transfer.service.ts keys off these exact ids', () => {
    expect(PAYMENT_METHOD_ID.TRANSFER_DEBIT).toBe(
      '00000000-0000-7000-8000-000000000004',
    );
    expect(PAYMENT_METHOD_ID.TRANSFER_CREDIT).toBe(
      '00000000-0000-7000-8000-000000000006',
    );
  });
});

describe('categorySeeds', () => {
  it('SALARY_CATEGORY_SEED_ID matches the seeded Salary category, used by dashboard.service.ts', () => {
    const salary = categorySeeds.find((c) => c.id === SALARY_CATEGORY_SEED_ID);
    expect(salary?.name).toBe('Salary');
    expect(salary?.type).toBe('credit');
  });

  it('every explicitly-set id (including nested children) is unique and a valid UUIDv7', () => {
    const explicitIds = flattenCategories(categorySeeds)
      .map((c) => c.id)
      .filter((id): id is string => id !== undefined);
    expect(new Set(explicitIds).size).toBe(explicitIds.length);
    for (const id of explicitIds) {
      expect(id).toMatch(UUID_V7_SHAPE);
    }
  });

  it('every category, top-level or nested, has a debit or credit type', () => {
    for (const category of flattenCategories(categorySeeds)) {
      expect(['debit', 'credit']).toContain(category.type);
    }
  });
});

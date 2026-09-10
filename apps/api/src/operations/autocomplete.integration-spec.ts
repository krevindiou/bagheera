import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { category } from '../db/schema';
import { PAYMENT_METHOD_ID, SALARY_CATEGORY_SEED_ID } from '../db/seed-data';
import {
  seedSignedInMember,
  SignedInFixture,
} from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';

async function createBank(mutate: SignedInFixture['mutate']): Promise<string> {
  const res = await mutate('post', '/banks/choice', { name: 'Test bank' });
  return (res.body as { id: string }).id;
}

async function createAccount(
  mutate: SignedInFixture['mutate'],
  bankId: string,
): Promise<string> {
  const res = await mutate('post', '/accounts', {
    bankId,
    name: 'Account',
    currency: 'EUR',
  });
  return (res.body as { account: { id: string } }).account.id;
}

async function debitCategoryId(app: INestApplication): Promise<string> {
  const [row] = await getDb(app)
    .select({ id: category.id })
    .from(category)
    .where(eq(category.type, 'debit'));
  return row.id;
}

describe('GET /operations/autocomplete', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a case-insensitively deduped third party with its latest category', async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountId = await createAccount(mutate, bankId);
    const debitCatId = await debitCategoryId(app);

    await mutate('post', '/operations', {
      accountId,
      type: 'debit',
      thirdParty: 'amazon',
      amount: 10,
      categoryId: debitCatId,
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      valueDate: '2026-01-01',
    });
    await mutate('post', '/operations', {
      accountId,
      type: 'credit',
      thirdParty: 'Amazon',
      amount: 5,
      categoryId: SALARY_CATEGORY_SEED_ID,
      paymentMethodId: PAYMENT_METHOD_ID.DEPOSIT,
      valueDate: '2026-01-02',
    });

    const res = await agent.get('/operations/autocomplete?q=ama').expect(200);
    const body = res.body as {
      thirdParty: string;
      categoryId: string | null;
    }[];
    expect(body).toHaveLength(1);
    // Latest by valueDate is the second (credit) operation.
    expect(body[0].categoryId).toBe(SALARY_CATEGORY_SEED_ID);
  });

  it("nulls the category when its type doesn't match the requested type, keeping the third party", async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountId = await createAccount(mutate, bankId);
    const debitCatId = await debitCategoryId(app);

    await mutate('post', '/operations', {
      accountId,
      type: 'debit',
      thirdParty: 'Landlord',
      amount: 10,
      categoryId: debitCatId,
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      valueDate: '2026-01-01',
    });

    const res = await agent
      .get('/operations/autocomplete?q=land&type=credit')
      .expect(200);
    const body = res.body as {
      thirdParty: string;
      categoryId: string | null;
    }[];
    expect(body).toHaveLength(1);
    expect(body[0].thirdParty).toBe('Landlord');
    expect(body[0].categoryId).toBeNull();
  });

  it('rejects a query shorter than 2 characters', async () => {
    const { agent } = await seedSignedInMember(app);
    await agent.get('/operations/autocomplete?q=a').expect(400);
  });

  it("never returns another member's third parties", async () => {
    const { mutate: otherMutate } = await seedSignedInMember(app);
    const otherBankId = await createBank(otherMutate);
    const otherAccountId = await createAccount(otherMutate, otherBankId);
    await otherMutate('post', '/operations', {
      accountId: otherAccountId,
      type: 'debit',
      thirdParty: 'Zzzprivate',
      amount: 10,
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      valueDate: '2026-01-01',
    });

    const { agent } = await seedSignedInMember(app);
    const res = await agent
      .get('/operations/autocomplete?q=zzzpriv')
      .expect(200);
    expect(res.body).toEqual([]);
  });
});

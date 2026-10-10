import type { EntryType } from '@bagheera/reference-data';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { PAYMENT_METHOD_ID, SALARY_CATEGORY_SEED_ID } from '../db/seed-data';
import { seedSignedInMember, SignedInFixture } from '../test-support/auth-fixture';
import { createTestApp } from '../test-support/create-test-app';

async function createBank(mutate: SignedInFixture['mutate']): Promise<string> {
  const res = await mutate('post', '/banks/choice', { name: 'Test bank' });
  return (res.body as { id: string }).id;
}

async function createAccount(
  mutate: SignedInFixture['mutate'],
): Promise<{ bankId: string; accountId: string }> {
  const bankId = await createBank(mutate);
  const res = await mutate('post', '/accounts', {
    bankId,
    name: 'Account',
    currency: 'EUR',
  });
  return {
    bankId,
    accountId: (res.body as { account: { id: string } }).account.id,
  };
}

async function createOperation(
  mutate: SignedInFixture['mutate'],
  accountId: string,
  overrides: {
    type?: EntryType;
    thirdParty?: string;
    amount?: number;
    reconciled?: boolean;
    valueDate?: string;
    paymentMethodId?: string;
    categoryId?: string;
    notes?: string;
  } = {},
) {
  const type = overrides.type ?? 'debit';
  const res = await mutate('post', '/operations', {
    accountId,
    type,
    thirdParty: overrides.thirdParty ?? 'X',
    amount: overrides.amount ?? 10,
    paymentMethodId:
      overrides.paymentMethodId ??
      (type === 'debit' ? PAYMENT_METHOD_ID.CREDIT_CARD : PAYMENT_METHOD_ID.DEPOSIT),
    categoryId: overrides.categoryId,
    valueDate: overrides.valueDate ?? '2026-01-01',
    notes: overrides.notes,
    reconciled: overrides.reconciled,
  });
  expect(res.status).toBe(200);
}

interface SearchResult {
  items: { thirdParty: string }[];
  total: number;
}

describe('operations search', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('filters by thirdParty, type, and reconciled, remembers criteria, and can be cleared', async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const { accountId } = await createAccount(mutate);
    await createOperation(mutate, accountId, {
      thirdParty: 'Grocery Store',
      type: 'debit',
      reconciled: true,
    });
    await createOperation(mutate, accountId, {
      thirdParty: 'Employer',
      type: 'credit',
      reconciled: false,
    });

    const searchRes = await mutate('post', `/operations/search?page=1`, {
      accountId,
      thirdParty: 'grocery',
    });
    expect(searchRes.status).toBe(200);
    const searchBody = searchRes.body as SearchResult;
    expect(searchBody.total).toBe(1);
    expect(searchBody.items[0].thirdParty).toBe('Grocery Store');

    // Recall: listing the account's operations re-applies the remembered
    // criteria without resubmitting them.
    const recallRes = await agent.get(`/operations?accountId=${accountId}&page=1`).expect(200);
    const recallBody = recallRes.body as SearchResult & {
      active: boolean;
      criteria: Record<string, unknown>;
    };
    expect(recallBody.total).toBe(1);
    expect(recallBody.active).toBe(true);
    expect(recallBody.criteria.thirdParty).toBe('grocery');

    // Clear: recall now returns everything, unfiltered.
    const clearRes = await mutate('delete', `/operations/search?accountId=${accountId}`);
    expect(clearRes.status).toBe(200);

    const afterClear = await agent.get(`/operations?accountId=${accountId}&page=1`).expect(200);
    const afterClearBody = afterClear.body as SearchResult & {
      active: boolean;
    };
    expect(afterClearBody.active).toBe(false);
    expect(afterClearBody.total).toBe(2);
  });

  it('filters by an amount comparator', async () => {
    const { mutate } = await seedSignedInMember(app);
    const { accountId } = await createAccount(mutate);
    await createOperation(mutate, accountId, { amount: 10 });
    await createOperation(mutate, accountId, { amount: 100 });

    const res = await mutate('post', '/operations/search?page=1', {
      accountId,
      amountComparators: [{ operator: 'gte', value: 50 }],
    });
    const body = res.body as SearchResult;
    expect(body.total).toBe(1);
  });

  it('filters by date range', async () => {
    const { mutate } = await seedSignedInMember(app);
    const { accountId } = await createAccount(mutate);
    await createOperation(mutate, accountId, { valueDate: '2026-01-01' });
    await createOperation(mutate, accountId, { valueDate: '2026-06-01' });

    const res = await mutate('post', '/operations/search?page=1', {
      accountId,
      dateFrom: '2026-03-01',
    });
    const body = res.body as SearchResult;
    expect(body.total).toBe(1);
  });

  describe('each criterion on its own', () => {
    let mutate: SignedInFixture['mutate'];
    let accountId: string;

    beforeAll(async () => {
      ({ mutate } = await seedSignedInMember(app));
      ({ accountId } = await createAccount(mutate));
      await createOperation(mutate, accountId, {
        thirdParty: 'Cafe',
        valueDate: '2026-01-01',
        notes: 'Team lunch',
        reconciled: true,
      });
      await createOperation(mutate, accountId, {
        thirdParty: 'Landlord',
        paymentMethodId: PAYMENT_METHOD_ID.CHECK_DEBIT,
        valueDate: '2026-06-01',
        notes: 'Rent',
        reconciled: false,
      });
      await createOperation(mutate, accountId, {
        thirdParty: 'Employer',
        type: 'credit',
        categoryId: SALARY_CATEGORY_SEED_ID,
        valueDate: '2026-03-01',
        reconciled: false,
      });
    });

    it.each([
      ['type', { type: 'credit' }, ['Employer']],
      ['categoryIds', { categoryIds: [SALARY_CATEGORY_SEED_ID] }, ['Employer']],
      ['paymentMethodIds', { paymentMethodIds: [PAYMENT_METHOD_ID.CHECK_DEBIT] }, ['Landlord']],
      ['dateTo', { dateTo: '2026-02-01' }, ['Cafe']],
      ['notes, case-insensitively', { notes: 'LUNCH' }, ['Cafe']],
      ['reconciled: true', { reconciled: true }, ['Cafe']],
      ['reconciled: false', { reconciled: false }, ['Employer', 'Landlord']],
    ])('filters by %s', async (_name, criteria, expected) => {
      const res = await mutate('post', '/operations/search?page=1', { accountId, ...criteria });
      expect(res.status).toBe(200);
      const thirdParties = (res.body as SearchResult).items.map((item) => item.thirdParty);
      expect(thirdParties.sort()).toEqual(expected);
    });
  });

  it("404s searching, recalling, and clearing another member's account", async () => {
    const { mutate: ownerMutate } = await seedSignedInMember(app);
    const { accountId } = await createAccount(ownerMutate);

    const { agent: attackerAgent, mutate: attackerMutate } = await seedSignedInMember(app);

    const searchRes = await attackerMutate('post', '/operations/search', {
      accountId,
    });
    expect(searchRes.status).toBe(404);

    await attackerAgent.get(`/operations?accountId=${accountId}`).expect(404);

    const clearRes = await attackerMutate('delete', `/operations/search?accountId=${accountId}`);
    expect(clearRes.status).toBe(404);
  });
});

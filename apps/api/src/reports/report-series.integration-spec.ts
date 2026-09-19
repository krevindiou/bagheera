import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { PAYMENT_METHOD_ID, SALARY_CATEGORY_SEED_ID } from '../db/seed-data';
import { seedSignedInMember, SignedInFixture } from '../test-support/auth-fixture';
import { createTestApp } from '../test-support/create-test-app';

async function createBank(mutate: SignedInFixture['mutate']): Promise<string> {
  const res = await mutate('post', '/banks/choice', { name: 'Test bank' });
  return (res.body as { id: string }).id;
}

async function createAccount(mutate: SignedInFixture['mutate'], bankId: string): Promise<string> {
  const res = await mutate('post', '/accounts', {
    bankId,
    name: 'Account',
    currency: 'EUR',
  });
  return (res.body as { account: { id: string } }).account.id;
}

async function createOperation(
  mutate: SignedInFixture['mutate'],
  accountId: string,
  type: 'debit' | 'credit',
  amount: number,
  valueDate: string,
  categoryId?: string,
) {
  const res = await mutate('post', '/operations', {
    accountId,
    type,
    thirdParty: 'X',
    amount,
    paymentMethodId: type === 'debit' ? PAYMENT_METHOD_ID.CREDIT_CARD : PAYMENT_METHOD_ID.DEPOSIT,
    valueDate,
    categoryId,
  });
  expect(res.status).toBe(200);
}

interface SeriesBody {
  hidden: boolean;
  series: { currency: string; credit: unknown[]; debit: unknown[] }[];
}

describe('GET /reports/:id/series', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('is hidden when the member has no accounts at all', async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const created = await mutate('post', '/reports', {
      type: 'sum',
      title: 'Empty',
      periodGrouping: 'month',
    });
    const { id } = (created.body as { report: { id: string } }).report;

    const res = await agent.get(`/reports/${id}/series`).expect(200);
    const body = res.body as SeriesBody;
    expect(body.hidden).toBe(true);
  });

  it('aggregates linked-account operations by month', async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountId = await createAccount(mutate, bankId);
    await createOperation(mutate, accountId, 'debit', 30, '2026-01-15');
    await createOperation(mutate, accountId, 'credit', 100, '2026-01-20');

    const created = await mutate('post', '/reports', {
      type: 'sum',
      title: 'Monthly',
      periodGrouping: 'month',
      accountIds: [accountId],
    });
    const { id } = (created.body as { report: { id: string } }).report;

    const res = await agent.get(`/reports/${id}/series`).expect(200);
    const body = res.body as SeriesBody;
    expect(body.hidden).toBe(false);
    expect(body.series).toHaveLength(1);
    expect(body.series[0].currency).toBe('EUR');
  });

  it('scopes the series to the linked categories only', async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountId = await createAccount(mutate, bankId);
    await createOperation(mutate, accountId, 'credit', 1000, '2026-01-15', SALARY_CATEGORY_SEED_ID);
    await createOperation(mutate, accountId, 'credit', 100, '2026-01-20');

    const created = await mutate('post', '/reports', {
      type: 'sum',
      title: 'Salary only',
      periodGrouping: 'month',
      accountIds: [accountId],
      categoryIds: [SALARY_CATEGORY_SEED_ID],
    });
    const { id } = (created.body as { report: { id: string } }).report;

    const res = await agent.get(`/reports/${id}/series`).expect(200);
    const body = res.body as SeriesBody & { series: { credit: { value: number }[] }[] };
    expect(body.series[0].credit).toEqual([{ period: '2026-01-01', value: 1000 }]);
  });

  it("groups everything into a single bucket for 'all'", async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountId = await createAccount(mutate, bankId);
    await createOperation(mutate, accountId, 'debit', 10, '2020-01-01');
    await createOperation(mutate, accountId, 'debit', 10, '2026-01-01');

    const created = await mutate('post', '/reports', {
      type: 'sum',
      title: 'All-time',
      periodGrouping: 'all',
      accountIds: [accountId],
    });
    const { id } = (created.body as { report: { id: string } }).report;

    const res = await agent.get(`/reports/${id}/series`).expect(200);
    const body = res.body as SeriesBody & {
      series: { debit: { period: string }[] }[];
    };
    expect(body.series[0].debit).toHaveLength(1);
  });

  it('is hidden when the report is scoped to accounts with no operations', async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountId = await createAccount(mutate, bankId);

    const created = await mutate('post', '/reports', {
      type: 'sum',
      title: 'No data',
      periodGrouping: 'month',
      accountIds: [accountId],
    });
    const { id } = (created.body as { report: { id: string } }).report;

    const res = await agent.get(`/reports/${id}/series`).expect(200);
    const body = res.body as SeriesBody;
    expect(body.hidden).toBe(true);
  });

  it("404s reading another member's report series", async () => {
    const { mutate: ownerMutate } = await seedSignedInMember(app);
    const created = await ownerMutate('post', '/reports', {
      type: 'sum',
      title: 'Private',
      periodGrouping: 'month',
    });
    const { id } = (created.body as { report: { id: string } }).report;

    const { agent: attackerAgent } = await seedSignedInMember(app);
    await attackerAgent.get(`/reports/${id}/series`).expect(404);
  });
});

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
  bankId: string,
  initialBalance?: number,
): Promise<string> {
  const res = await mutate('post', '/accounts', {
    bankId,
    name: 'Account',
    currency: 'EUR',
    initialBalance,
  });
  return (res.body as { account: { id: string } }).account.id;
}

/** A date guaranteed to fall in the previous calendar month relative to whenever this test actually runs. */
function dayInPreviousCalendarMonth(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
  return d.toISOString().slice(0, 10);
}

interface DashboardBody {
  onboarding: string | null;
  totalBalances: { currency: string; amount: number; reconciledAmount: number }[];
  lastSalary: { amount: number; currency: string } | null;
  lastBiggestExpense: { amount: number; currency: string } | null;
  synthesisChart: { series: { currency: string; points: { period: string; value: number }[] }[] };
  accountsOverview: {
    id: string;
    accounts: { id: string; balance: number; reconciledBalance: number; history: number[] }[];
  }[];
  homepageReports: { id: string; title: string }[];
}

describe('GET /dashboard', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('flags onboarding when the member has no banks yet', async () => {
    const { agent } = await seedSignedInMember(app);
    const res = await agent.get('/dashboard').expect(200);
    const body = res.body as DashboardBody;
    expect(body.onboarding).toBe('no-bank');
    expect(body.totalBalances).toEqual([]);
    expect(body.homepageReports).toEqual([]);
  });

  it('flags onboarding when the member has an active bank but no account', async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    await createBank(mutate);

    const res = await agent.get('/dashboard').expect(200);
    expect((res.body as DashboardBody).onboarding).toBe('no-account');
  });

  it('reports the total balance and per-account overview', async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    await createAccount(mutate, bankId, 250);

    const res = await agent.get('/dashboard').expect(200);
    const body = res.body as DashboardBody;
    expect(body.onboarding).toBeNull();
    expect(body.totalBalances).toEqual([{ currency: 'EUR', amount: 250, reconciledAmount: 250 }]);
    expect(body.accountsOverview).toHaveLength(1);
    expect(body.accountsOverview[0].accounts[0].balance).toBe(250);
  });

  it("ends each account overview tile's sparkline history at its current balance", async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    await createAccount(mutate, bankId, 250);

    const res = await agent.get('/dashboard').expect(200);
    const body = res.body as DashboardBody;
    const history = body.accountsOverview[0].accounts[0].history;
    expect(history.length).toBeGreaterThan(0);
    expect(history[history.length - 1]).toBe(250);
  });

  it("ends both the synthesis chart and each tile's sparkline at the latest operation, not today", async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    // No initial balance — that operation would be dated today (see
    // `operation.valueDate`'s `defaultNow()`), defeating the point below.
    const accountId = await createAccount(mutate, bankId);
    // Dated years before "today" — if either window were anchored to the
    // real current date, the last point's period would be this month.
    await mutate('post', '/operations', {
      accountId,
      type: 'debit',
      thirdParty: 'Old',
      amount: 10,
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      valueDate: '2020-01-15',
    });

    const res = await agent.get('/dashboard').expect(200);
    const body = res.body as DashboardBody;
    const synthesisPoints = body.synthesisChart.series[0].points;
    expect(synthesisPoints[synthesisPoints.length - 1]).toEqual({
      period: '2020-01-01',
      value: -10,
    });
    const history = body.accountsOverview[0].accounts[0].history;
    expect(history[history.length - 1]).toBe(-10);
  });

  it('widens the synthesis chart window with ?range=24 and ?range=all', async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountId = await createAccount(mutate, bankId);
    await mutate('post', '/operations', {
      accountId,
      type: 'debit',
      thirdParty: 'Old',
      amount: 10,
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      valueDate: '2020-01-15',
    });

    const res24 = await agent.get('/dashboard?range=24').expect(200);
    const body24 = res24.body as DashboardBody;
    expect(body24.synthesisChart.series[0].points).toHaveLength(24);

    const resAll = await agent.get('/dashboard?range=all').expect(200);
    const bodyAll = resAll.body as DashboardBody;
    const allPoints = bodyAll.synthesisChart.series[0].points;
    expect(allPoints[0].period).toBe('2020-01-01');
  });

  it('reports the total reconciled balance separately, excluding unreconciled operations', async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    // The initial-balance opening operation is always reconciled (see
    // AccountService.create) — a second, unreconciled operation is what
    // makes the total and reconciled total actually diverge.
    const accountId = await createAccount(mutate, bankId, 250);
    await mutate('post', '/operations', {
      accountId,
      type: 'debit',
      thirdParty: 'Unreconciled',
      amount: 50,
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      valueDate: '2026-01-01',
      reconciled: false,
    });

    const res = await agent.get('/dashboard').expect(200);
    const body = res.body as DashboardBody;
    expect(body.totalBalances).toEqual([{ currency: 'EUR', amount: 200, reconciledAmount: 250 }]);
  });

  it("also reports each account overview tile's own reconciled balance, excluding unreconciled operations", async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountId = await createAccount(mutate, bankId, 250);
    await mutate('post', '/operations', {
      accountId,
      type: 'debit',
      thirdParty: 'Unreconciled',
      amount: 50,
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      valueDate: '2026-01-01',
      reconciled: false,
    });

    const res = await agent.get('/dashboard').expect(200);
    const body = res.body as DashboardBody;
    const tile = body.accountsOverview[0].accounts[0];
    expect(tile.balance).toBe(200);
    expect(tile.reconciledBalance).toBe(250);
  });

  it('reports the last salary from a Salary-categorized credit', async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountId = await createAccount(mutate, bankId);
    const res1 = await mutate('post', '/operations', {
      accountId,
      type: 'credit',
      thirdParty: 'Employer',
      amount: 2000,
      categoryId: SALARY_CATEGORY_SEED_ID,
      paymentMethodId: PAYMENT_METHOD_ID.DEPOSIT,
      valueDate: '2026-01-01',
    });
    expect(res1.status).toBe(200);

    const res = await agent.get('/dashboard').expect(200);
    const body = res.body as DashboardBody;
    expect(body.lastSalary).toEqual({
      amount: 2000,
      currency: 'EUR',
      valueDate: '2026-01-01',
    });
  });

  it("reports last month's biggest non-scheduled expense", async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountId = await createAccount(mutate, bankId);
    const lastMonthDate = dayInPreviousCalendarMonth();
    await mutate('post', '/operations', {
      accountId,
      type: 'debit',
      thirdParty: 'Small',
      amount: 20,
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      valueDate: lastMonthDate,
    });
    await mutate('post', '/operations', {
      accountId,
      type: 'debit',
      thirdParty: 'Big',
      amount: 500,
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      valueDate: lastMonthDate,
    });

    const res = await agent.get('/dashboard').expect(200);
    const body = res.body as DashboardBody;
    expect(body.lastBiggestExpense).toEqual({
      amount: 500,
      currency: 'EUR',
      valueDate: lastMonthDate,
    });
  });

  it('includes a non-empty homepage report and excludes a non-homepage one', async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountId = await createAccount(mutate, bankId);
    await mutate('post', '/operations', {
      accountId,
      type: 'debit',
      thirdParty: 'X',
      amount: 10,
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      valueDate: '2026-01-01',
    });
    await mutate('post', '/reports', {
      type: 'sum',
      title: 'On homepage',
      periodGrouping: 'month',
      homepage: true,
      accountIds: [accountId],
    });
    await mutate('post', '/reports', {
      type: 'sum',
      title: 'Not on homepage',
      periodGrouping: 'month',
      homepage: false,
      accountIds: [accountId],
    });

    const res = await agent.get('/dashboard').expect(200);
    const body = res.body as DashboardBody;
    expect(body.homepageReports.map((r) => r.title)).toEqual(['On homepage']);
  });
});

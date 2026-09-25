import { toMinorUnits } from '../common/money';
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

async function findCategoryId(agent: SignedInFixture['agent'], name: string): Promise<string> {
  const res = await agent.get('/reference-data/categories').expect(200);
  const body = res.body as { id: string; name: string }[];
  return body.find((c) => c.name === name)!.id;
}

async function createOperation(
  mutate: SignedInFixture['mutate'],
  accountId: string,
  overrides: Record<string, unknown>,
) {
  const res = await mutate('post', '/operations', {
    accountId,
    type: 'debit',
    thirdParty: 'X',
    amount: 10,
    paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
    valueDate: '2026-01-01',
    ...overrides,
  });
  expect(res.status).toBe(200);
}

function createDistributionReport(
  mutate: SignedInFixture['mutate'],
  overrides: Record<string, unknown> = {},
) {
  return mutate('post', '/reports', {
    type: 'distribution',
    title: 'Distribution',
    dataGrouping: 'category',
    significantResultsNumber: 5,
    periodGrouping: 'all',
    ...overrides,
  });
}

interface DistributionLabelSeries {
  label: string | null;
  points: { period: string; value: number }[];
}
interface DistributionBody {
  hidden: boolean;
  series: {
    currency: string;
    debit: DistributionLabelSeries[];
    credit: DistributionLabelSeries[];
  }[];
}

// Snapshot ('all' periodGrouping) reports have exactly one point per label
// series — this pulls just the values out for the terser assertions below.
function snapshotValues(
  labelSeries: DistributionLabelSeries[],
): { label: string | null; value: number }[] {
  return labelSeries.map((s) => ({ label: s.label, value: s.points[0].value }));
}

describe('GET /reports/:id/distribution', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('is hidden when the member has no accounts at all', async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const created = await createDistributionReport(mutate, { title: 'Empty' });
    const { id } = (created.body as { report: { id: string } }).report;

    const res = await agent.get(`/reports/${id}/distribution`).expect(200);
    expect((res.body as DistributionBody).hidden).toBe(true);
  });

  it('ranks by category, folding uncategorized operations into Other', async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountId = await createAccount(mutate, bankId);
    const foodId = await findCategoryId(agent, 'Food');
    const transportId = await findCategoryId(agent, 'Transport');

    await createOperation(mutate, accountId, { amount: 100, categoryId: foodId });
    await createOperation(mutate, accountId, { amount: 30, categoryId: transportId });
    // No categoryId at all — should land in the "Other" (null-label) bucket.
    await createOperation(mutate, accountId, { amount: 5 });

    const created = await createDistributionReport(mutate, {
      title: 'By category',
      accountIds: [accountId],
    });
    const { id } = (created.body as { report: { id: string } }).report;

    const res = await agent.get(`/reports/${id}/distribution`).expect(200);
    const body = res.body as DistributionBody;
    expect(body.hidden).toBe(false);
    expect(body.series).toHaveLength(1);
    expect(body.series[0].currency).toBe('EUR');
    expect(snapshotValues(body.series[0].debit)).toEqual([
      { label: 'Food', value: toMinorUnits(100) },
      { label: 'Transport', value: toMinorUnits(30) },
      { label: null, value: toMinorUnits(5) },
    ]);
    expect(body.series[0].credit).toEqual([]);
  });

  it('collapses the ranked tail into Other beyond significantResultsNumber', async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountId = await createAccount(mutate, bankId);

    await createOperation(mutate, accountId, { amount: 50, thirdParty: 'Alpha' });
    await createOperation(mutate, accountId, { amount: 40, thirdParty: 'Beta' });
    await createOperation(mutate, accountId, { amount: 30, thirdParty: 'Gamma' });

    const created = await createDistributionReport(mutate, {
      title: 'By third party',
      dataGrouping: 'third_party',
      significantResultsNumber: 2,
      accountIds: [accountId],
    });
    const { id } = (created.body as { report: { id: string } }).report;

    const res = await agent.get(`/reports/${id}/distribution`).expect(200);
    const body = res.body as DistributionBody;
    expect(snapshotValues(body.series[0].debit)).toEqual([
      { label: 'Alpha', value: toMinorUnits(50) },
      { label: 'Beta', value: toMinorUnits(40) },
      { label: null, value: toMinorUnits(30) },
    ]);
  });

  it('ranks by payment method', async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountId = await createAccount(mutate, bankId);

    await createOperation(mutate, accountId, {
      amount: 20,
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
    });
    await createOperation(mutate, accountId, {
      amount: 15,
      paymentMethodId: PAYMENT_METHOD_ID.CHECK_DEBIT,
    });

    const created = await createDistributionReport(mutate, {
      title: 'By payment method',
      dataGrouping: 'payment_method',
      accountIds: [accountId],
    });
    const { id } = (created.body as { report: { id: string } }).report;

    const res = await agent.get(`/reports/${id}/distribution`).expect(200);
    const body = res.body as DistributionBody;
    expect(snapshotValues(body.series[0].debit)).toEqual([
      { label: 'Credit card', value: toMinorUnits(20) },
      { label: 'Check', value: toMinorUnits(15) },
    ]);
  });

  it('splits debit and credit into separate rankings', async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountId = await createAccount(mutate, bankId);

    await createOperation(mutate, accountId, {
      amount: 40,
      type: 'debit',
      thirdParty: 'X',
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
    });
    await createOperation(mutate, accountId, {
      amount: 500,
      type: 'credit',
      thirdParty: 'X',
      categoryId: SALARY_CATEGORY_SEED_ID,
      paymentMethodId: PAYMENT_METHOD_ID.DEPOSIT,
    });

    const created = await createDistributionReport(mutate, {
      title: 'Debit vs credit',
      accountIds: [accountId],
    });
    const { id } = (created.body as { report: { id: string } }).report;

    const res = await agent.get(`/reports/${id}/distribution`).expect(200);
    const body = res.body as DistributionBody;
    expect(snapshotValues(body.series[0].debit)).toEqual([
      { label: null, value: toMinorUnits(40) },
    ]);
    expect(snapshotValues(body.series[0].credit)).toEqual([
      { label: 'Salary', value: toMinorUnits(500) },
    ]);
  });

  it('honors the date range, third-party, reconciled and account filters', async () => {
    const { agent, mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountId = await createAccount(mutate, bankId);
    const foodId = await findCategoryId(agent, 'Food');

    await createOperation(mutate, accountId, {
      amount: 10,
      categoryId: foodId,
      valueDate: '2020-01-01',
    });
    await createOperation(mutate, accountId, {
      amount: 20,
      categoryId: foodId,
      valueDate: '2026-06-01',
      reconciled: false,
    });

    const created = await createDistributionReport(mutate, {
      title: 'Filtered',
      accountIds: [accountId],
      valueDateStart: '2026-01-01',
      reconciledOnly: true,
    });
    const { id } = (created.body as { report: { id: string } }).report;

    const res = await agent.get(`/reports/${id}/distribution`).expect(200);
    const body = res.body as DistributionBody;
    // Neither operation qualifies: the 2020 one is out of range, the 2026
    // one is unreconciled — so the report has no data at all.
    expect(body.hidden).toBe(true);
  });

  it("404s reading another member's report distribution", async () => {
    const { mutate: ownerMutate } = await seedSignedInMember(app);
    const created = await createDistributionReport(ownerMutate, { title: 'Private' });
    const { id } = (created.body as { report: { id: string } }).report;

    const { agent: attackerAgent } = await seedSignedInMember(app);
    await attackerAgent.get(`/reports/${id}/distribution`).expect(404);
  });

  describe('with a month periodGrouping', () => {
    it('ranks each month, zero-filling a label absent from a given month', async () => {
      const { agent, mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);
      const foodId = await findCategoryId(agent, 'Food');
      const transportId = await findCategoryId(agent, 'Transport');

      await createOperation(mutate, accountId, {
        amount: 100,
        categoryId: foodId,
        valueDate: '2026-01-15',
      });
      await createOperation(mutate, accountId, {
        amount: 30,
        categoryId: transportId,
        valueDate: '2026-02-10',
      });

      const created = await createDistributionReport(mutate, {
        title: 'Monthly by category',
        periodGrouping: 'month',
        accountIds: [accountId],
      });
      const { id } = (created.body as { report: { id: string } }).report;

      const res = await agent.get(`/reports/${id}/distribution`).expect(200);
      const body = res.body as DistributionBody;
      const debit = body.series[0].debit;
      expect(debit.find((s) => s.label === 'Food')!.points).toEqual([
        { period: '2026-01-01', value: toMinorUnits(100) },
        { period: '2026-02-01', value: 0 },
      ]);
      expect(debit.find((s) => s.label === 'Transport')!.points).toEqual([
        { period: '2026-01-01', value: 0 },
        { period: '2026-02-01', value: toMinorUnits(30) },
      ]);
    });

    it('keeps the top-N set fixed across periods rather than re-ranking each month', async () => {
      const { agent, mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);
      const foodId = await findCategoryId(agent, 'Food');
      const transportId = await findCategoryId(agent, 'Transport');
      const leisureId = await findCategoryId(agent, 'Leisure');

      // Whole-range totals: Food=100 (1st), Transport=60 (2nd), Leisure=50
      // (3rd, dropped by significantResultsNumber: 2) — but in February
      // alone, Leisure (50) outweighs both Food (0) and Transport (10).
      // Leisure must still fold into Other in February, not bump one of
      // the whole-range top two out of its own series.
      await createOperation(mutate, accountId, {
        amount: 100,
        categoryId: foodId,
        valueDate: '2026-01-10',
      });
      await createOperation(mutate, accountId, {
        amount: 50,
        categoryId: transportId,
        valueDate: '2026-01-15',
      });
      await createOperation(mutate, accountId, {
        amount: 10,
        categoryId: transportId,
        valueDate: '2026-02-10',
      });
      await createOperation(mutate, accountId, {
        amount: 50,
        categoryId: leisureId,
        valueDate: '2026-02-20',
      });

      const created = await createDistributionReport(mutate, {
        title: 'Fixed ranking',
        significantResultsNumber: 2,
        periodGrouping: 'month',
        accountIds: [accountId],
      });
      const { id } = (created.body as { report: { id: string } }).report;

      const res = await agent.get(`/reports/${id}/distribution`).expect(200);
      const body = res.body as DistributionBody;
      const debit = body.series[0].debit;
      expect(debit.map((s) => s.label)).toEqual(['Food', 'Transport', null]);
      expect(debit.find((s) => s.label === null)!.points).toEqual([
        { period: '2026-01-01', value: 0 },
        { period: '2026-02-01', value: toMinorUnits(50) },
      ]);
    });
  });
});

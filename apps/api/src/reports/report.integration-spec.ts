import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { eq } from 'drizzle-orm';
import { report, reportAccount, reportCategory } from '../db/schema';
import { SALARY_CATEGORY_SEED_ID } from '../db/seed-data';
import { seedSignedInMember, SignedInFixture } from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';

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

function reportPayload(overrides: Record<string, unknown> = {}) {
  return {
    type: 'sum',
    title: 'My report',
    periodGrouping: 'month',
    ...overrides,
  };
}

describe('reports', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /reports', () => {
    it('creates a report with no accounts selected', async () => {
      const { mutate, memberId } = await seedSignedInMember(app);

      const res = await mutate('post', '/reports', reportPayload());
      expect(res.status).toBe(200);
      const { report: created } = res.body as {
        report: { id: string; accountIds: string[] };
      };
      expect(created.accountIds).toEqual([]);

      const [row] = await getDb(app).select().from(report).where(eq(report.id, created.id));
      expect(row.memberId).toBe(memberId);
    });

    it('links owned accounts and silently drops a foreign one', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const ownAccountId = await createAccount(mutate, bankId);

      const { mutate: otherMutate } = await seedSignedInMember(app);
      const otherBankId = await createBank(otherMutate);
      const foreignAccountId = await createAccount(otherMutate, otherBankId);

      const res = await mutate(
        'post',
        '/reports',
        reportPayload({ accountIds: [ownAccountId, foreignAccountId] }),
      );
      const { report: created } = res.body as {
        report: { id: string; accountIds: string[] };
      };
      expect(created.accountIds).toEqual([ownAccountId]);

      const links = await getDb(app)
        .select()
        .from(reportAccount)
        .where(eq(reportAccount.reportId, created.id));
      expect(links).toHaveLength(1);
    });

    it('links known categories and silently drops an unknown one', async () => {
      const { mutate } = await seedSignedInMember(app);
      const unknownCategoryId = '00000000-0000-7000-8000-999999999999';

      const res = await mutate(
        'post',
        '/reports',
        reportPayload({ categoryIds: [SALARY_CATEGORY_SEED_ID, unknownCategoryId] }),
      );
      const { report: created } = res.body as {
        report: { id: string; categoryIds: string[] };
      };
      expect(created.categoryIds).toEqual([SALARY_CATEGORY_SEED_ID]);

      const links = await getDb(app)
        .select()
        .from(reportCategory)
        .where(eq(reportCategory.reportId, created.id));
      expect(links).toHaveLength(1);
    });

    it('rejects a value date range with the end before the start', async () => {
      const { mutate } = await seedSignedInMember(app);

      const res = await mutate(
        'post',
        '/reports',
        reportPayload({ valueDateStart: '2026-02-01', valueDateEnd: '2026-01-01' }),
      );
      expect(res.status).toBe(400);
    });

    it('accepts a value date range with the end equal to the start', async () => {
      const { mutate } = await seedSignedInMember(app);

      const res = await mutate(
        'post',
        '/reports',
        reportPayload({ valueDateStart: '2026-01-01', valueDateEnd: '2026-01-01' }),
      );
      expect(res.status).toBe(200);
    });
  });

  describe('GET /reports', () => {
    it("lists only the caller's own reports with their linked accounts/categories", async () => {
      const { agent, mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);
      await mutate(
        'post',
        '/reports',
        reportPayload({ accountIds: [accountId], categoryIds: [SALARY_CATEGORY_SEED_ID] }),
      );

      const { mutate: otherMutate } = await seedSignedInMember(app);
      await otherMutate('post', '/reports', reportPayload({ title: "Other's" }));

      const res = await agent.get('/reports').expect(200);
      const body = res.body as { title: string; accountIds: string[]; categoryIds: string[] }[];
      expect(body).toHaveLength(1);
      expect(body[0].accountIds).toEqual([accountId]);
      expect(body[0].categoryIds).toEqual([SALARY_CATEGORY_SEED_ID]);
    });
  });

  describe('POST /reports — distribution fields', () => {
    it('persists dataGrouping, significantResultsNumber and periodGrouping', async () => {
      const { mutate, memberId } = await seedSignedInMember(app);

      const res = await mutate('post', '/reports', {
        type: 'distribution',
        title: 'Spending by category',
        dataGrouping: 'category',
        significantResultsNumber: 5,
        periodGrouping: 'month',
      });
      expect(res.status).toBe(200);
      const { report: created } = res.body as { report: { id: string } };

      const [row] = await getDb(app).select().from(report).where(eq(report.id, created.id));
      expect(row.memberId).toBe(memberId);
      expect(row.dataGrouping).toBe('category');
      expect(row.significantResultsNumber).toBe(5);
      expect(row.periodGrouping).toBe('month');
    });

    it('rejects a distribution report missing dataGrouping/significantResultsNumber/periodGrouping', async () => {
      const { mutate } = await seedSignedInMember(app);
      const res = await mutate('post', '/reports', {
        type: 'distribution',
        title: 'Incomplete',
      });
      expect(res.status).toBe(400);
    });

    it('clears dataGrouping/significantResultsNumber when edited back to a sum report', async () => {
      const { mutate } = await seedSignedInMember(app);
      const created = await mutate('post', '/reports', {
        type: 'distribution',
        title: 'Was a distribution',
        dataGrouping: 'category',
        significantResultsNumber: 5,
        periodGrouping: 'all',
      });
      const { id } = (created.body as { report: { id: string } }).report;

      const res = await mutate('patch', `/reports/${id}`, reportPayload({ title: 'Now a sum' }));
      expect(res.status).toBe(200);

      const [row] = await getDb(app).select().from(report).where(eq(report.id, id));
      expect(row.dataGrouping).toBeNull();
      expect(row.significantResultsNumber).toBeNull();
      expect(row.periodGrouping).toBe('month');
    });
  });

  describe('PATCH /reports/:id', () => {
    it('replaces the account selection wholesale', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountA = await createAccount(mutate, bankId);
      const accountB = await createAccount(mutate, bankId);
      const created = await mutate('post', '/reports', reportPayload({ accountIds: [accountA] }));
      const { id } = (created.body as { report: { id: string } }).report;

      const res = await mutate(
        'patch',
        `/reports/${id}`,
        reportPayload({ accountIds: [accountB] }),
      );
      expect(res.status).toBe(200);

      const links = await getDb(app)
        .select()
        .from(reportAccount)
        .where(eq(reportAccount.reportId, id));
      expect(links.map((l) => l.accountId)).toEqual([accountB]);
    });

    it('replaces the category selection wholesale', async () => {
      const { mutate } = await seedSignedInMember(app);
      const created = await mutate(
        'post',
        '/reports',
        reportPayload({ categoryIds: [SALARY_CATEGORY_SEED_ID] }),
      );
      const { id } = (created.body as { report: { id: string } }).report;

      const res = await mutate('patch', `/reports/${id}`, reportPayload({ categoryIds: [] }));
      expect(res.status).toBe(200);

      const links = await getDb(app)
        .select()
        .from(reportCategory)
        .where(eq(reportCategory.reportId, id));
      expect(links).toHaveLength(0);
    });

    it("404s updating another member's report", async () => {
      const { mutate: ownerMutate } = await seedSignedInMember(app);
      const created = await ownerMutate('post', '/reports', reportPayload());
      const { id } = (created.body as { report: { id: string } }).report;

      const { mutate: attackerMutate } = await seedSignedInMember(app);
      const res = await attackerMutate(
        'patch',
        `/reports/${id}`,
        reportPayload({ title: 'Hijacked' }),
      );
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /reports/:id', () => {
    it('deletes the report and its account/category links', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);
      const created = await mutate(
        'post',
        '/reports',
        reportPayload({ accountIds: [accountId], categoryIds: [SALARY_CATEGORY_SEED_ID] }),
      );
      const { id } = (created.body as { report: { id: string } }).report;

      const res = await mutate('delete', `/reports/${id}`);
      expect(res.status).toBe(200);

      const rows = await getDb(app).select().from(report).where(eq(report.id, id));
      expect(rows).toHaveLength(0);
      const links = await getDb(app)
        .select()
        .from(reportAccount)
        .where(eq(reportAccount.reportId, id));
      expect(links).toHaveLength(0);
      const categoryLinks = await getDb(app)
        .select()
        .from(reportCategory)
        .where(eq(reportCategory.reportId, id));
      expect(categoryLinks).toHaveLength(0);
    });
  });
});

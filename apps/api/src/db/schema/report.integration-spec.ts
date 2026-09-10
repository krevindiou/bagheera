import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createTestApp, getDb } from '../../test-support/create-test-app';
import { insertMemberBankAccount } from '../../test-support/db-fixtures';
import * as schema from './index';
import { report, reportAccount } from './report';

type Db = NodePgDatabase<typeof schema>;

function insertReport(
  db: Db,
  memberId: string,
  overrides: Partial<typeof report.$inferInsert> = {},
) {
  return db
    .insert(report)
    .values({
      memberId,
      type: 'sum',
      title: 'Test report',
      periodGrouping: 'month',
      ...overrides,
    })
    .returning();
}

describe('report schema', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('report.memberId FK', () => {
    it('rejects a report pointing at a member that does not exist', async () => {
      await expect(
        insertReport(getDb(app), randomUUID()),
      ).rejects.toMatchObject({ cause: { code: '23503' } });
    });

    it('accepts a report pointing at a real member', async () => {
      const { member } = await insertMemberBankAccount(getDb(app));
      const [row] = await insertReport(getDb(app), member.id);
      expect(row.memberId).toBe(member.id);
    });
  });

  describe('report_account join table', () => {
    it('rejects a (reportId, accountId) pair pointing at a report that does not exist', async () => {
      const { account } = await insertMemberBankAccount(getDb(app));

      await expect(
        getDb(app)
          .insert(reportAccount)
          .values({ reportId: randomUUID(), accountId: account.id }),
      ).rejects.toMatchObject({ cause: { code: '23503' } });
    });

    it('rejects a (reportId, accountId) pair pointing at an account that does not exist', async () => {
      const { member } = await insertMemberBankAccount(getDb(app));
      const [reportRow] = await insertReport(getDb(app), member.id);

      await expect(
        getDb(app)
          .insert(reportAccount)
          .values({ reportId: reportRow.id, accountId: randomUUID() }),
      ).rejects.toMatchObject({ cause: { code: '23503' } });
    });

    it('accepts a real pair and rejects inserting the exact same pair twice', async () => {
      const { member, account } = await insertMemberBankAccount(getDb(app));
      const [reportRow] = await insertReport(getDb(app), member.id);

      await getDb(app)
        .insert(reportAccount)
        .values({ reportId: reportRow.id, accountId: account.id });

      await expect(
        getDb(app)
          .insert(reportAccount)
          .values({ reportId: reportRow.id, accountId: account.id }),
      ).rejects.toMatchObject({ cause: { code: '23505' } });
    });
  });
});

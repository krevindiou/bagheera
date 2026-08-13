import { sql } from 'drizzle-orm';
import {
  connectIntegrationDb,
  IntegrationDb,
} from '../test-utils/integration-db';
import { account } from './account';
import { bank } from './bank';
import { member } from './member';
import { report, reportAccount } from './report';

describe('report schema', () => {
  let ctx: IntegrationDb;
  let memberId: number;
  let accountId: number;

  beforeAll(() => {
    ctx = connectIntegrationDb();
  });

  beforeEach(async () => {
    await ctx.db.execute(
      sql`truncate table ${reportAccount}, ${report}, ${account}, ${bank}, ${member} restart identity cascade`,
    );
    const [memberRow] = await ctx.db
      .insert(member)
      .values({ email: 'owner@example.com', password: 'hash', country: 'FR' })
      .returning({ id: member.id });
    memberId = memberRow.id;
    const [bankRow] = await ctx.db
      .insert(bank)
      .values({ memberId, name: 'Some Bank' })
      .returning({ id: bank.id });
    const [accountRow] = await ctx.db
      .insert(account)
      .values({ bankId: bankRow.id, name: 'Checking', currency: 'EUR' })
      .returning({ id: account.id });
    accountId = accountRow.id;
  });

  afterAll(async () => {
    await ctx.pool.end();
  });

  it('inserts a report with linked accounts', async () => {
    const [reportRow] = await ctx.db
      .insert(report)
      .values({
        memberId,
        type: 'sum',
        title: 'Monthly overview',
        periodGrouping: 'month',
      })
      .returning();
    expect(reportRow).toMatchObject({ homepage: false, type: 'sum' });

    await ctx.db.insert(reportAccount).values({
      reportId: reportRow.id,
      accountId,
    });

    const links = await ctx.db
      .select()
      .from(reportAccount)
      .where(sql`${reportAccount.reportId} = ${reportRow.id}`);
    expect(links).toHaveLength(1);
  });

  it('rejects a report account link with no matching report', async () => {
    await expect(
      ctx.db.insert(reportAccount).values({ reportId: 9999, accountId }),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
  });
});

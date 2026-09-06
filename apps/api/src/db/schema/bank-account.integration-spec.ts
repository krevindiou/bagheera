import { sql } from 'drizzle-orm';
import {
  connectIntegrationDb,
  IntegrationDb,
} from '../test-utils/integration-db';
import { account } from './account';
import { bank } from './bank';
import { member } from './member';

describe('bank + account schema', () => {
  let ctx: IntegrationDb;

  beforeAll(() => {
    ctx = connectIntegrationDb();
  });

  beforeEach(async () => {
    await ctx.db.execute(
      sql`truncate table ${account}, ${bank}, ${member} restart identity cascade`,
    );
  });

  afterAll(async () => {
    await ctx.pool.end();
  });

  async function seedMember(): Promise<string> {
    const [row] = await ctx.db
      .insert(member)
      .values({ email: 'owner@example.com', password: 'hash', country: 'FR' })
      .returning({ id: member.id });
    return row.id;
  }

  // Well-formed UUIDv7 that matches no row — used to trigger FK violations.
  const NONEXISTENT_ID = '00000000-0000-7000-8000-00000000ffff';

  it('rejects a bank with no matching member', async () => {
    await expect(
      ctx.db
        .insert(bank)
        .values({ memberId: NONEXISTENT_ID, name: 'Some Bank' }),
    ).rejects.toMatchObject({ cause: { code: '23503' } }); // foreign_key_violation
  });

  it('rejects an account with no matching bank', async () => {
    await expect(
      ctx.db.insert(account).values({
        bankId: NONEXISTENT_ID,
        name: 'Checking',
        currency: 'EUR',
      }),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
  });

  it('accepts an account whose bank exists, with correct closed/deleted defaults', async () => {
    const memberId = await seedMember();
    const [bankRow] = await ctx.db
      .insert(bank)
      .values({ memberId, name: 'Some Bank' })
      .returning({ id: bank.id });

    const [accountRow] = await ctx.db
      .insert(account)
      .values({ bankId: bankRow.id, name: 'Checking', currency: 'EUR' })
      .returning();

    expect(accountRow).toMatchObject({ closed: false, deleted: false });

    const [fullBankRow] = await ctx.db
      .select()
      .from(bank)
      .where(sql`${bank.id} = ${bankRow.id}`);
    expect(fullBankRow).toMatchObject({ closed: false, deleted: false });
  });
});

import { sql } from 'drizzle-orm';
import {
  connectIntegrationDb,
  IntegrationDb,
} from '../test-utils/integration-db';
import { member } from './member';

describe('member schema', () => {
  let ctx: IntegrationDb;

  beforeAll(() => {
    ctx = connectIntegrationDb();
  });

  beforeEach(async () => {
    await ctx.db.execute(
      sql`truncate table ${member} restart identity cascade`,
    );
  });

  afterAll(async () => {
    await ctx.pool.end();
  });

  it('rejects a duplicate email (case-insensitive)', async () => {
    await ctx.db.insert(member).values({
      email: 'person@example.com',
      password: 'hash',
      country: 'FR',
    });

    await expect(
      ctx.db.insert(member).values({
        email: 'Person@Example.com',
        password: 'hash',
        country: 'FR',
      }),
    ).rejects.toMatchObject({ cause: { code: '23505' } }); // unique_violation
  });

  it('accepts distinct emails', async () => {
    await ctx.db.insert(member).values({
      email: 'a@example.com',
      password: 'hash',
      country: 'FR',
    });
    await ctx.db.insert(member).values({
      email: 'b@example.com',
      password: 'hash',
      country: 'FR',
    });

    const rows = await ctx.db.select().from(member);
    expect(rows).toHaveLength(2);
  });
});

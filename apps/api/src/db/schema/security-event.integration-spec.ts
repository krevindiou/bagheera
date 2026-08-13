import { sql } from 'drizzle-orm';
import {
  connectIntegrationDb,
  IntegrationDb,
} from '../test-utils/integration-db';
import { member } from './member';
import { securityEvent } from './security-event';

describe('security_event schema', () => {
  let ctx: IntegrationDb;

  beforeAll(() => {
    ctx = connectIntegrationDb();
  });

  beforeEach(async () => {
    await ctx.db.execute(
      sql`truncate table ${securityEvent}, ${member} restart identity cascade`,
    );
  });

  afterAll(async () => {
    await ctx.pool.end();
  });

  it('inserts an event row with timestamp, member, source address and type', async () => {
    const [memberRow] = await ctx.db
      .insert(member)
      .values({ email: 'owner@example.com', password: 'hash', country: 'FR' })
      .returning({ id: member.id });

    const [eventRow] = await ctx.db
      .insert(securityEvent)
      .values({
        memberId: memberRow.id,
        eventType: 'sign_in_success',
        sourceAddress: '203.0.113.42',
      })
      .returning();

    expect(eventRow).toMatchObject({
      memberId: memberRow.id,
      eventType: 'sign_in_success',
      sourceAddress: '203.0.113.42',
    });
    expect(eventRow.createdAt).toBeInstanceOf(Date);
  });

  it('allows a null member (e.g. sign-in failure against an unknown email)', async () => {
    const [eventRow] = await ctx.db
      .insert(securityEvent)
      .values({
        eventType: 'sign_in_failure',
        sourceAddress: '203.0.113.42',
      })
      .returning();

    expect(eventRow.memberId).toBeNull();
  });
});

import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { member } from '../db/schema';
import { csrfTokenFor, seedSignedInMember } from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';

describe('POST /members/time-zone', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  async function storedTimeZone(memberId: string): Promise<string | null> {
    const [row] = await getDb(app).select().from(member).where(eq(member.id, memberId));
    return row.timeZone;
  }

  it("updates the signed-in member's time zone, no step-up required", async () => {
    const { mutate, memberId } = await seedSignedInMember(app);

    const res = await mutate('post', '/members/time-zone', { timeZone: 'America/New_York' });
    expect(res.status).toBe(200);

    expect(await storedTimeZone(memberId)).toBe('America/New_York');
  });

  it('rejects an invalid time zone and leaves the stored one unchanged', async () => {
    const { mutate, memberId } = await seedSignedInMember(app);

    const res = await mutate('post', '/members/time-zone', { timeZone: '+01:00' });
    expect(res.status).toBe(400);

    expect(await storedTimeZone(memberId)).toBeNull();
  });

  it('rejects an unauthenticated request', async () => {
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);

    await agent
      .post('/members/time-zone')
      .set('x-csrf-token', csrfToken)
      .send({ timeZone: 'Europe/Paris' })
      .expect(401);
  });
});

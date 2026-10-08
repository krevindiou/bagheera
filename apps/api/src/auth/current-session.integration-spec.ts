import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { member, securityEvent } from '../db/schema';
import { seedSignedInMember } from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';

describe('GET /auth/me', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the signed-in member's email, locale and time zone", async () => {
    const { agent, email } = await seedSignedInMember(app);
    const res = await agent.get('/auth/me').expect(200);
    // No time zone on file: APP_TIMEZONE, unset in tests, so UTC.
    expect(res.body).toEqual({ email, locale: 'en', timeZone: 'UTC' });
  });

  it('returns a non-default locale and time zone as-is', async () => {
    const { agent, email, memberId } = await seedSignedInMember(app, { locale: 'fr' });
    await getDb(app)
      .update(member)
      .set({ timeZone: 'Europe/Paris' })
      .where(eq(member.id, memberId));
    const res = await agent.get('/auth/me').expect(200);
    expect(res.body).toEqual({ email, locale: 'fr', timeZone: 'Europe/Paris' });
  });

  it('rejects an unauthenticated request', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.get('/auth/me').expect(401);
  });

  it('rejects a session whose member row no longer exists', async () => {
    const { agent, memberId } = await seedSignedInMember(app);
    await agent.get('/auth/me').expect(200);

    // Sign-in logged a security_event row referencing this member; clear it
    // or the member delete hits that FK.
    const db = getDb(app);
    await db.delete(securityEvent).where(eq(securityEvent.memberId, memberId));
    await db.delete(member).where(eq(member.id, memberId));

    await agent.get('/auth/me').expect(401);
  });
});

import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, desc, eq } from 'drizzle-orm';
import request from 'supertest';
import { member, securityEvent } from '../db/schema';
import { HashService } from '../security/hash.service';
import {
  csrfTokenFor,
  insertActiveMember,
  seedSignedInMember,
  uniqueEmail,
} from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';

function messageOf(res: request.Response): string {
  return (res.body as { message: string }).message;
}

async function lastEvent(
  app: INestApplication<Server>,
  eventType: (typeof securityEvent.$inferSelect)['eventType'],
  memberId: string | null,
) {
  const db = getDb(app);
  const conditions =
    memberId === null
      ? eq(securityEvent.eventType, eventType)
      : and(
          eq(securityEvent.eventType, eventType),
          eq(securityEvent.memberId, memberId),
        );
  const [row] = await db
    .select()
    .from(securityEvent)
    .where(conditions)
    .orderBy(desc(securityEvent.createdAt))
    .limit(1);
  return row;
}

describe('POST /auth/sign-in', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('signs in with correct credentials, updates loggedAt, and records sign_in_success', async () => {
    const { email, password, memberId } = await insertActiveMember(app);
    const before = await getDb(app)
      .select({ loggedAt: member.loggedAt })
      .from(member)
      .where(eq(member.id, memberId));
    expect(before[0].loggedAt).toBeNull();

    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);
    const res = await agent
      .post('/auth/sign-in')
      .set('x-csrf-token', csrfToken)
      .send({ email, password })
      .expect(200);
    expect(res.body).toEqual({ message: 'ok' });

    const after = await getDb(app)
      .select({ loggedAt: member.loggedAt })
      .from(member)
      .where(eq(member.id, memberId));
    expect(after[0].loggedAt).toBeInstanceOf(Date);

    const event = await lastEvent(app, 'sign_in_success', memberId);
    expect(event).toBeDefined();

    // The session actually works — an authenticated endpoint now succeeds.
    await agent.get('/auth/me').expect(200);
  });

  it('rejects a wrong password with the generic anti-enumeration message', async () => {
    const { email, memberId } = await insertActiveMember(app);

    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);
    const res = await agent
      .post('/auth/sign-in')
      .set('x-csrf-token', csrfToken)
      .send({ email, password: 'definitely-the-wrong-password' })
      .expect(401);

    expect(messageOf(res)).toBe('Invalid email or password');
    expect(await lastEvent(app, 'sign_in_failure', memberId)).toBeDefined();
  });

  it('rejects an unknown email with the exact same message as a wrong password', async () => {
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);
    const res = await agent
      .post('/auth/sign-in')
      .set('x-csrf-token', csrfToken)
      .send({ email: uniqueEmail('nobody'), password: 'whatever12' })
      .expect(401);

    expect(messageOf(res)).toBe('Invalid email or password');
    expect(await lastEvent(app, 'sign_in_failure', null)).toBeDefined();
  });

  it('rejects a correct password for an inactive (never-activated) account', async () => {
    const db = getDb(app);
    const email = uniqueEmail();
    const password = 'not-yet-active-pw';
    const hash = await app.get(HashService).hash(password);
    const [row] = await db
      .insert(member)
      .values({ email, password: hash, country: 'FR', active: false })
      .returning({ id: member.id });

    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);
    const res = await agent
      .post('/auth/sign-in')
      .set('x-csrf-token', csrfToken)
      .send({ email, password })
      .expect(403);

    expect(messageOf(res)).toBe('Your account is not activated yet.');
    expect(await lastEvent(app, 'sign_in_inactive', row.id)).toBeDefined();
  });

  it('rejects a sign-in with no CSRF token', async () => {
    const { email, password } = await insertActiveMember(app);
    const agent = request.agent(app.getHttpServer());
    // Establish the session/csrf cookie pair, but never echo the header.
    await csrfTokenFor(agent);

    await agent.post('/auth/sign-in').send({ email, password }).expect(403);
  });

  it("seedSignedInMember's fixture actually authenticates the returned agent", async () => {
    const { agent } = await seedSignedInMember(app);
    await agent.get('/auth/me').expect(200);
  });
});

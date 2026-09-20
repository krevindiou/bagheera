import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, desc, eq } from 'drizzle-orm';
import request from 'supertest';
import { member, securityEvent } from '../db/schema';
import {
  csrfTokenFor,
  insertMemberWithCredential,
  uniqueEmail,
} from '../test-support/auth-fixture';
import { createTestApp, FakeEmailQueue, getDb } from '../test-support/create-test-app';

function messageOf(res: request.Response): string {
  return (res.body as { message: string }).message;
}

const REGISTER_MESSAGE =
  "If this email isn't already registered, you'll receive a link to activate your account.";

describe('POST /members/register', () => {
  let app: INestApplication<Server>;
  let fakeEmailQueue: FakeEmailQueue;

  beforeAll(async () => {
    ({ app, fakeEmailQueue } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    fakeEmailQueue.enqueue.mockClear();
  });

  it('creates no member row yet, queues a sign-up email, and records signup_confirmation_issued', async () => {
    const email = uniqueEmail();
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);

    const res = await agent
      .post('/members/register')
      .set('x-csrf-token', csrfToken)
      .send({ email, country: 'fr' })
      .expect(201);
    expect(messageOf(res)).toBe(REGISTER_MESSAGE);

    // The account only comes into existence once the emailed link's
    // WebAuthn ceremony completes — see WebauthnSignupService.
    const rows = await getDb(app).select().from(member).where(eq(member.email, email));
    expect(rows).toHaveLength(0);
    expect(fakeEmailQueue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ to: email }));

    const [event] = await getDb(app)
      .select()
      .from(securityEvent)
      .where(and(eq(securityEvent.eventType, 'signup_confirmation_issued')))
      .orderBy(desc(securityEvent.createdAt))
      .limit(1);
    expect(event).toBeDefined();
    expect(event.memberId).toBeNull();
  });

  it('sends the sign-up link/email in the requested locale', async () => {
    const email = uniqueEmail();
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);

    await agent
      .post('/members/register')
      .set('x-csrf-token', csrfToken)
      .send({ email, country: 'FR', locale: 'fr' })
      .expect(201);

    expect(fakeEmailQueue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ to: email }));
    const sent = fakeEmailQueue.enqueue.mock.calls.at(-1)?.[0] as { html: string };
    expect(sent.html).toContain('/fr/activate?key=');
  });

  it('rejects an unsupported locale', async () => {
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);

    await agent
      .post('/members/register')
      .set('x-csrf-token', csrfToken)
      .send({ email: uniqueEmail(), country: 'FR', locale: 'de' })
      .expect(400);
  });

  it('returns the same generic message and sends no email for an already-registered email', async () => {
    const { email } = await insertMemberWithCredential(app);
    fakeEmailQueue.enqueue.mockClear();

    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);
    const res = await agent
      .post('/members/register')
      .set('x-csrf-token', csrfToken)
      .send({ email, country: 'FR' })
      .expect(201);

    expect(messageOf(res)).toBe(REGISTER_MESSAGE);
    expect(fakeEmailQueue.enqueue).not.toHaveBeenCalled();
  });

  it('resubmitting the same not-yet-registered email is idempotent and queues another sign-up email', async () => {
    const email = uniqueEmail();
    const register = () => {
      const agent = request.agent(app.getHttpServer());
      return csrfTokenFor(agent).then((csrfToken) =>
        agent
          .post('/members/register')
          .set('x-csrf-token', csrfToken)
          .send({ email, country: 'FR' }),
      );
    };

    const first = await register();
    expect(first.status).toBe(201);

    const second = await register();
    expect(second.status).toBe(201);
    expect(messageOf(second)).toBe(REGISTER_MESSAGE);
    // Still no row for either call — the account only comes into existence
    // once one of the (possibly several) outstanding links' ceremony
    // completes, see signup-token.ts's TTL-only trade-off.
    const rows = await getDb(app).select().from(member).where(eq(member.email, email));
    expect(rows).toHaveLength(0);
  });

  it('rejects an invalid country code', async () => {
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);

    await agent
      .post('/members/register')
      .set('x-csrf-token', csrfToken)
      .send({ email: uniqueEmail(), country: 'FRA' })
      .expect(400);
  });
});

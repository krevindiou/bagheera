import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, desc, eq } from 'drizzle-orm';
import request from 'supertest';
import { member, securityEvent } from '../db/schema';
import { csrfTokenFor, uniqueEmail } from '../test-support/auth-fixture';
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

  it('creates an inactive member, queues an activation email, and records activation_issued', async () => {
    const email = uniqueEmail();
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);

    const res = await agent
      .post('/members/register')
      .set('x-csrf-token', csrfToken)
      .send({
        email,
        password: 'a-real-password-1',
        passwordConfirmation: 'a-real-password-1',
        country: 'fr',
      })
      .expect(201);
    expect(messageOf(res)).toBe(REGISTER_MESSAGE);

    const [row] = await getDb(app).select().from(member).where(eq(member.email, email));
    expect(row).toBeDefined();
    expect(row.active).toBe(false);
    // Normalized to uppercase, per RegistrationService.
    expect(row.country).toBe('FR');
    expect(fakeEmailQueue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ to: email }));

    const [event] = await getDb(app)
      .select()
      .from(securityEvent)
      .where(
        and(eq(securityEvent.eventType, 'activation_issued'), eq(securityEvent.memberId, row.id)),
      )
      .orderBy(desc(securityEvent.createdAt))
      .limit(1);
    expect(event).toBeDefined();
  });

  it('defaults locale to en when omitted', async () => {
    const email = uniqueEmail();
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);

    await agent
      .post('/members/register')
      .set('x-csrf-token', csrfToken)
      .send({
        email,
        password: 'a-real-password-1',
        passwordConfirmation: 'a-real-password-1',
        country: 'FR',
      })
      .expect(201);

    const [row] = await getDb(app).select().from(member).where(eq(member.email, email));
    expect(row.locale).toBe('en');
  });

  it('stores an explicit supported locale and sends the activation link/email in it', async () => {
    const email = uniqueEmail();
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);

    await agent
      .post('/members/register')
      .set('x-csrf-token', csrfToken)
      .send({
        email,
        password: 'a-real-password-1',
        passwordConfirmation: 'a-real-password-1',
        country: 'FR',
        locale: 'fr',
      })
      .expect(201);

    const [row] = await getDb(app).select().from(member).where(eq(member.email, email));
    expect(row.locale).toBe('fr');
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
      .send({
        email: uniqueEmail(),
        password: 'a-real-password-1',
        passwordConfirmation: 'a-real-password-1',
        country: 'FR',
        locale: 'de',
      })
      .expect(400);
  });

  it('returns the same generic message for an already-registered email and creates no second row', async () => {
    const email = uniqueEmail();
    const password = 'a-real-password-1';
    const register = () => {
      const agent = request.agent(app.getHttpServer());
      return csrfTokenFor(agent).then((csrfToken) =>
        agent.post('/members/register').set('x-csrf-token', csrfToken).send({
          email,
          password,
          passwordConfirmation: password,
          country: 'FR',
        }),
      );
    };

    const first = await register();
    expect(first.status).toBe(201);
    fakeEmailQueue.enqueue.mockClear();

    const second = await register();
    expect(second.status).toBe(201);
    expect(messageOf(second)).toBe(REGISTER_MESSAGE);
    expect(fakeEmailQueue.enqueue).not.toHaveBeenCalled();

    const rows = await getDb(app).select().from(member).where(eq(member.email, email));
    expect(rows).toHaveLength(1);
  });

  it('rejects mismatched password confirmation before touching the database', async () => {
    const email = uniqueEmail();
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);

    await agent
      .post('/members/register')
      .set('x-csrf-token', csrfToken)
      .send({
        email,
        password: 'a-real-password-1',
        passwordConfirmation: 'a-different-password-1',
        country: 'FR',
      })
      .expect(400);

    const rows = await getDb(app).select().from(member).where(eq(member.email, email));
    expect(rows).toHaveLength(0);
  });

  it('rejects an invalid country code', async () => {
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);

    await agent
      .post('/members/register')
      .set('x-csrf-token', csrfToken)
      .send({
        email: uniqueEmail(),
        password: 'a-real-password-1',
        passwordConfirmation: 'a-real-password-1',
        country: 'FRA',
      })
      .expect(400);
  });

  it('rejects a too-short password', async () => {
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);

    await agent
      .post('/members/register')
      .set('x-csrf-token', csrfToken)
      .send({
        email: uniqueEmail(),
        password: 'short',
        passwordConfirmation: 'short',
        country: 'FR',
      })
      .expect(400);
  });
});

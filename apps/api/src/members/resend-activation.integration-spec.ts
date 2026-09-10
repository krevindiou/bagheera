import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { member } from '../db/schema';
import { HashService } from '../security/hash.service';
import { csrfTokenFor, uniqueEmail } from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';

function messageOf(res: request.Response): string {
  return (res.body as { message: string }).message;
}

async function insertInactiveMember(app: INestApplication) {
  const email = uniqueEmail();
  const password = 'inactive-member-pw-1';
  const hash = await app.get(HashService).hash(password);
  const [row] = await getDb(app)
    .insert(member)
    .values({ email, password: hash, country: 'FR', active: false })
    .returning();
  return { email, password, row };
}

describe('POST /members/resend-activation', () => {
  let app: INestApplication;
  let fakeEmailQueue: { enqueue: jest.Mock };

  beforeAll(async () => {
    ({ app, fakeEmailQueue } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    fakeEmailQueue.enqueue.mockClear();
  });

  it('reissues an activation email, bumping the token version, for a correct inactive-member login', async () => {
    const { email, password, row } = await insertInactiveMember(app);
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);

    const res = await agent
      .post('/members/resend-activation')
      .set('x-csrf-token', csrfToken)
      .send({ email, password })
      .expect(200);

    expect(messageOf(res)).toBe('A new activation email has been sent.');
    expect(fakeEmailQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ to: email }),
    );

    const [updated] = await getDb(app)
      .select({ activationTokenVersion: member.activationTokenVersion })
      .from(member)
      .where(eq(member.id, row.id));
    expect(updated.activationTokenVersion).toBe(row.activationTokenVersion + 1);
  });

  it('rejects a wrong password with the generic message and queues nothing', async () => {
    const { email } = await insertInactiveMember(app);
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);

    const res = await agent
      .post('/members/resend-activation')
      .set('x-csrf-token', csrfToken)
      .send({ email, password: 'not-the-password' })
      .expect(401);

    expect(messageOf(res)).toBe('Invalid email or password');
    expect(fakeEmailQueue.enqueue).not.toHaveBeenCalled();
  });

  it('rejects an unknown email with the same generic message', async () => {
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);

    const res = await agent
      .post('/members/resend-activation')
      .set('x-csrf-token', csrfToken)
      .send({ email: uniqueEmail('nobody'), password: 'whatever12' })
      .expect(401);

    expect(messageOf(res)).toBe('Invalid email or password');
  });

  it('no-ops silently for an already-active member (correct credentials, no email queued)', async () => {
    const email = uniqueEmail();
    const password = 'already-active-pw-1';
    const hash = await app.get(HashService).hash(password);
    const [row] = await getDb(app)
      .insert(member)
      .values({ email, password: hash, country: 'FR', active: true })
      .returning();

    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);
    const res = await agent
      .post('/members/resend-activation')
      .set('x-csrf-token', csrfToken)
      .send({ email, password })
      .expect(200);

    expect(messageOf(res)).toBe('A new activation email has been sent.');
    expect(fakeEmailQueue.enqueue).not.toHaveBeenCalled();

    const [updated] = await getDb(app)
      .select({ activationTokenVersion: member.activationTokenVersion })
      .from(member)
      .where(eq(member.id, row.id));
    expect(updated.activationTokenVersion).toBe(row.activationTokenVersion);
  });
});

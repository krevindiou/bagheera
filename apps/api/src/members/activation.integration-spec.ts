import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, desc, eq } from 'drizzle-orm';
import request from 'supertest';
import { member, securityEvent } from '../db/schema';
import { CryptoService } from '../security/crypto.service';
import { HashService } from '../security/hash.service';
import { csrfTokenFor, uniqueEmail } from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';
import { ActivationTokenPayload, buildActivationToken } from './activation-token';

function messageOf(res: request.Response): string {
  return (res.body as { message: string }).message;
}

const ACTIVATION_ERROR = 'Activation error (Already activated?)';

async function insertMemberRow(
  app: INestApplication<Server>,
  overrides: { active?: boolean; activationTokenVersion?: number } = {},
) {
  const email = uniqueEmail();
  const hash = await app.get(HashService).hash('some-password-1');
  const [row] = await getDb(app)
    .insert(member)
    .values({
      email,
      password: hash,
      country: 'FR',
      active: overrides.active ?? false,
      activationTokenVersion: overrides.activationTokenVersion ?? 0,
    })
    .returning();
  return row;
}

async function post(app: INestApplication<Server>, key: string) {
  const agent = request.agent(app.getHttpServer());
  const csrfToken = await csrfTokenFor(agent);
  return agent.post('/members/activate').set('x-csrf-token', csrfToken).send({ key });
}

describe('POST /members/activate', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('activates the member and records activation_used for a valid key', async () => {
    const row = await insertMemberRow(app);
    const key = buildActivationToken(app.get(CryptoService), row.email, row.activationTokenVersion);

    const res = await post(app, key);
    expect(res.status).toBe(200);
    expect(messageOf(res)).toBe('Account activated. You can now sign in.');

    const [updated] = await getDb(app)
      .select({ active: member.active })
      .from(member)
      .where(eq(member.id, row.id));
    expect(updated.active).toBe(true);

    const [event] = await getDb(app)
      .select()
      .from(securityEvent)
      .where(
        and(eq(securityEvent.eventType, 'activation_used'), eq(securityEvent.memberId, row.id)),
      )
      .orderBy(desc(securityEvent.createdAt))
      .limit(1);
    expect(event).toBeDefined();
  });

  it('rejects a malformed key', async () => {
    const res = await post(app, 'not-a-real-token');
    expect(res.status).toBe(400);
    expect(messageOf(res)).toBe(ACTIVATION_ERROR);
  });

  it('rejects an expired key', async () => {
    const row = await insertMemberRow(app);
    const payload: ActivationTokenPayload = {
      type: 'register',
      email: row.email,
      version: row.activationTokenVersion,
      exp: Date.now() - 1000,
    };
    const key = app.get(CryptoService).encrypt(JSON.stringify(payload));

    const res = await post(app, key);
    expect(res.status).toBe(400);
    expect(messageOf(res)).toBe(ACTIVATION_ERROR);
  });

  it('rejects a key minted under a since-superseded token version', async () => {
    const row = await insertMemberRow(app, { activationTokenVersion: 1 });
    // Built for version 0 — the member's row has already moved to 1.
    const key = buildActivationToken(app.get(CryptoService), row.email, 0);

    const res = await post(app, key);
    expect(res.status).toBe(400);
    expect(messageOf(res)).toBe(ACTIVATION_ERROR);
  });

  it('rejects a key for a member that is already active', async () => {
    const row = await insertMemberRow(app, { active: true });
    const key = buildActivationToken(app.get(CryptoService), row.email, row.activationTokenVersion);

    const res = await post(app, key);
    expect(res.status).toBe(400);
    expect(messageOf(res)).toBe(ACTIVATION_ERROR);
  });
});

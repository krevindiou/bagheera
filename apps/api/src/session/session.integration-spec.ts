import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import type { RedisClientType } from 'redis';
import {
  csrfTokenFor,
  insertActiveMember,
  seedSignedInMember,
} from '../test-support/auth-fixture';
import { createTestApp } from '../test-support/create-test-app';
import { SESSION_MAX_AGE_MS, VALKEY_CLIENT } from './session.constants';

interface StoredSession {
  memberId?: string;
  createdAt?: number;
  [key: string]: unknown;
}

async function findSessionKey(
  valkey: RedisClientType,
  memberId: string,
): Promise<string> {
  for await (const batch of valkey.scanIterator({ MATCH: 'sess:*' })) {
    const keys = Array.isArray(batch) ? batch : [batch];
    for (const key of keys) {
      const raw = await valkey.get(key);
      if (!raw) continue;
      const data = JSON.parse(raw) as StoredSession;
      if (data.memberId === memberId) {
        return key;
      }
    }
  }
  throw new Error(`No stored session found for member ${memberId}`);
}

describe('session lifecycle', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a mutating request with no CSRF token, even from an authenticated agent', async () => {
    const { agent } = await seedSignedInMember(app);
    await agent.post('/banks/choice').send({ name: 'No token' }).expect(403);
  });

  it('rotates the session id on sign-in (fixation defense)', async () => {
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);
    const valkey = app.get<RedisClientType>(VALKEY_CLIENT);

    const before = new Set<string>();
    for await (const batch of valkey.scanIterator({ MATCH: 'sess:*' })) {
      for (const key of Array.isArray(batch) ? batch : [batch]) {
        before.add(key);
      }
    }

    const { email, password } = await insertActiveMember(app);
    await agent
      .post('/auth/sign-in')
      .set('x-csrf-token', csrfToken)
      .send({ email, password })
      .expect(200);

    const after = new Set<string>();
    for await (const batch of valkey.scanIterator({ MATCH: 'sess:*' })) {
      for (const key of Array.isArray(batch) ? batch : [batch]) {
        after.add(key);
      }
    }

    const brandNewKeys = [...after].filter((key) => !before.has(key));
    expect(brandNewKeys.length).toBeGreaterThan(0);
  });

  // KNOWN BUG, not a test mistake — kept as `it.failing` rather than
  // asserting the crash as correct: CurrentSessionController.me() is
  // @Public() (deliberately, so an anonymous caller gets a clean 401
  // instead of SessionAuthGuard's) and reads `req.session.memberId`
  // directly with no optional chaining. absoluteSessionTtl's destroy()
  // path (session past the 24h absolute cap) deletes `req.session`
  // entirely mid-request (express-session's Session.prototype.destroy
  // does `delete this.req.session`) — every *other* protected path is
  // safe from this because SessionAuthGuard checks `req.session?.
  // memberId` (session-auth.guard.ts) before requireMemberId() ever runs,
  // but this one route has no guard in front of it and skips the `?.`
  // both. Net effect: the first request to /auth/me after a session
  // crosses the absolute TTL 500s instead of 401ing. One-line fix:
  // `req.session?.memberId` in current-session.controller.ts. Flagged for
  // the user rather than fixed here — out of scope for a test-writing pass.
  it.failing(
    'force-expires a session past the absolute TTL, regardless of activity',
    async () => {
      const { agent, memberId } = await seedSignedInMember(app);
      await agent.get('/auth/me').expect(200);

      const valkey = app.get<RedisClientType>(VALKEY_CLIENT);
      const key = await findSessionKey(valkey, memberId);
      const raw = await valkey.get(key);
      const data = JSON.parse(raw!) as StoredSession;
      data.createdAt = Date.now() - SESSION_MAX_AGE_MS - 1000;
      await valkey.set(key, JSON.stringify(data));

      await agent.get('/auth/me').expect(401);
    },
  );

  it("lets SessionAuthGuard reject an unauthenticated request before RateLimitGuard ever runs (app.module.ts's SessionModule-before-SecurityModule ordering)", async () => {
    // webauthn/registration/options requires auth and carries its own
    // @RateLimit({ points: 10, ... }) — if SecurityModule's guard ran
    // first, the 11th+ of these would 429 instead of 401.
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);

    for (let i = 0; i < 15; i++) {
      await agent
        .post('/webauthn/registration/options')
        .set('x-csrf-token', csrfToken)
        .expect(401);
    }
  });
});

import { INestApplication } from '@nestjs/common';
import { vi } from 'vitest';
import type { Server } from 'http';
import type { VerifiedAuthenticationResponse } from '@simplewebauthn/server';
import request from 'supertest';
import type IORedis from 'ioredis';
import { eq, sql } from 'drizzle-orm';
import { member } from '../db/schema';
import {
  csrfTokenFor,
  insertMemberWithCredential,
  seedSignedInMember,
  signInWithPasskey,
} from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';
import { WebauthnCryptoService } from '../webauthn/webauthn-crypto.service';
import { SessionRegistryService } from './session-registry.service';
import { withClockAhead } from '../test-support/with-clock-ahead';
import {
  ANONYMOUS_SESSION_MAX_AGE_MS,
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_TTL_SECONDS,
  SESSION_MAX_AGE_MS,
  VALKEY_CLIENT,
} from './session.constants';

interface StoredSession {
  memberId?: string;
  sessionEpoch?: number;
  createdAt?: number;
  [key: string]: unknown;
}

/** Every session key in Valkey (scanStream yields batches of keys). */
async function* sessionKeys(valkey: IORedis): AsyncGenerator<string> {
  for await (const batch of valkey.scanStream({ match: 'sess:*' })) {
    yield* batch as string[];
  }
}

async function countSessions(valkey: IORedis): Promise<number> {
  let count = 0;
  for await (const key of sessionKeys(valkey)) {
    void key;
    count += 1;
  }
  return count;
}

/** The Valkey key of the session a response's Set-Cookie hands out. */
function sessionKeyFrom(res: request.Response): string {
  const setCookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = setCookie.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!cookie) {
    throw new Error('Response set no session cookie');
  }
  // Signed value: "s:<session id>.<signature>".
  const value = decodeURIComponent(cookie.split(';')[0].slice(SESSION_COOKIE_NAME.length + 1));
  return `sess:${value.slice(2, value.lastIndexOf('.'))}`;
}

async function findSessionKey(valkey: IORedis, memberId: string): Promise<string> {
  for await (const key of sessionKeys(valkey)) {
    const raw = await valkey.get(key);
    if (!raw) continue;
    const data = JSON.parse(raw) as StoredSession;
    if (data.memberId === memberId) {
      return key;
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

  // Otherwise flooding any URL would fill Valkey.
  it('stores no session and sends no cookie for an anonymous request that keeps nothing', async () => {
    const valkey = app.get<IORedis>(VALKEY_CLIENT);
    const before = await countSessions(valkey);

    for (let i = 0; i < 5; i++) {
      const res = await request(app.getHttpServer()).get('/auth/me').expect(401);
      expect(res.headers['set-cookie']).toBeUndefined();
    }

    expect(await countSessions(valkey)).toBe(before);
  });

  // Both cookies must satisfy the browser's `__Host-` rules (Secure, Path=/,
  // no Domain) or it silently drops them — and then nothing signs in. Secure
  // itself can't be seen here: createTestApp strips it for plain http (see
  // fixSecureCookiesForPlainHttp); csrf.spec.ts pins it for the CSRF cookie.
  it.each([SESSION_COOKIE_NAME, CSRF_COOKIE_NAME])(
    'sets %s as a host-locked, strict, httpOnly cookie',
    async (name) => {
      const res = await request(app.getHttpServer()).get('/auth/csrf-token').expect(200);
      const setCookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
      const cookie = setCookie.find((c) => c.startsWith(`${name}=`));

      expect(name.startsWith('__Host-')).toBe(true);
      expect(cookie).toBeDefined();
      const attributes = cookie!.split(';').map((part) => part.trim().toLowerCase());
      expect(attributes).toEqual(expect.arrayContaining(['httponly', 'path=/', 'samesite=strict']));
      expect(attributes.some((part) => part.startsWith('domain='))).toBe(false);
    },
  );

  // Started on a later request, the clock would give a minted session
  // more than its cap.
  it("starts a kept session's absolute clock when it's first stored", async () => {
    const valkey = app.get<IORedis>(VALKEY_CLIENT);
    const before = Date.now();
    const key = sessionKeyFrom(
      await request(app.getHttpServer()).get('/auth/csrf-token').expect(200),
    );

    const stored = JSON.parse((await valkey.get(key))!) as StoredSession;
    expect(stored.createdAt).toBeGreaterThanOrEqual(before);
    expect(stored.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it('rejects a mutating request with no CSRF token, even from an authenticated agent', async () => {
    const { agent } = await seedSignedInMember(app);
    await agent.post('/banks/choice').send({ name: 'No token' }).expect(403);
  });

  it('rotates the session id on sign-in (fixation defense)', async () => {
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);
    const valkey = app.get<IORedis>(VALKEY_CLIENT);

    const before = new Set<string>();
    for await (const key of sessionKeys(valkey)) {
      before.add(key);
    }

    const { credentialId } = await insertMemberWithCredential(app);
    await agent.post('/webauthn/authentication/options').set('x-csrf-token', csrfToken).expect(200);
    vi.spyOn(app.get(WebauthnCryptoService), 'verifyAuthenticationResponse').mockResolvedValueOnce({
      verified: true,
      authenticationInfo: { newCounter: 1 },
    } as unknown as VerifiedAuthenticationResponse);
    await agent
      .post('/webauthn/authentication/verify')
      .set('x-csrf-token', csrfToken)
      .send({
        response: {
          id: credentialId,
          rawId: credentialId,
          response: {},
          clientExtensionResults: {},
          type: 'public-key',
        },
      })
      .expect(200);

    const after = new Set<string>();
    for await (const key of sessionKeys(valkey)) {
      after.add(key);
    }

    const brandNewKeys = [...after].filter((key) => !before.has(key));
    expect(brandNewKeys.length).toBeGreaterThan(0);
  });

  it('force-expires a session past the absolute TTL, regardless of activity', async () => {
    const { agent, memberId } = await seedSignedInMember(app);
    await agent.get('/auth/me').expect(200);

    const valkey = app.get<IORedis>(VALKEY_CLIENT);
    const key = await findSessionKey(valkey, memberId);
    const raw = await valkey.get(key);
    const data = JSON.parse(raw!) as StoredSession;
    data.createdAt = Date.now() - SESSION_MAX_AGE_MS - 1000;
    await valkey.set(key, JSON.stringify(data));

    await agent.get('/auth/me').expect(401);
  });

  describe('absolute caps', () => {
    async function mintedSession() {
      const agent = request.agent(app.getHttpServer());
      const res = await agent.get('/auth/csrf-token').expect(200);
      const { csrfToken } = res.body as { csrfToken: string };
      return { agent, key: sessionKeyFrom(res), csrfToken };
    }

    async function storedSession(key: string): Promise<StoredSession> {
      return JSON.parse((await app.get<IORedis>(VALKEY_CLIENT).get(key))!) as StoredSession;
    }

    // Moving the clock past an idle timeout instead would expire the
    // agent's own cookie, so the session would never be sent.
    async function backdate(key: string, ms: number): Promise<number> {
      const stored = await storedSession(key);
      const createdAt = stored.createdAt! - ms;
      await app
        .get<IORedis>(VALKEY_CLIENT)
        .set(key, JSON.stringify({ ...stored, createdAt }), 'KEEPTTL');
      return createdAt;
    }

    it('lets no refresh keep an anonymous session past one idle timeout', async () => {
      const valkey = app.get<IORedis>(VALKEY_CLIENT);
      const { agent, key } = await mintedSession();

      for (const route of ['/auth/me', '/auth/csrf-token']) {
        await withClockAhead(ANONYMOUS_SESSION_MAX_AGE_MS - 60_000, () => agent.get(route));
        const ttl = await valkey.pttl(key);
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(60_000);
      }
    });

    it('answers the token mint on an anonymous session past its cap with a fresh one', async () => {
      const valkey = app.get<IORedis>(VALKEY_CLIENT);
      const { agent, key } = await mintedSession();
      await backdate(key, ANONYMOUS_SESSION_MAX_AGE_MS + 1000);

      const res = await agent.get('/auth/csrf-token');

      expect(res.status).toBe(200);
      const freshKey = sessionKeyFrom(res);
      expect(freshKey).not.toBe(key);
      expect(await valkey.exists(key)).toBe(0);
      expect((await storedSession(freshKey)).createdAt).toEqual(expect.any(Number));
    });

    it('refuses a valid token pair on an anonymous session past its cap with 403, not 500', async () => {
      const { agent, key, csrfToken } = await mintedSession();
      await backdate(key, ANONYMOUS_SESSION_MAX_AGE_MS + 1000);

      const res = await agent
        .post('/webauthn/authentication/options')
        .set('x-csrf-token', csrfToken);

      expect(res.status).toBe(403);
    });

    // express-session saves a regenerated session even when nothing wrote to it.
    it('stores nothing in place of an expired session a request leaves empty', async () => {
      const valkey = app.get<IORedis>(VALKEY_CLIENT);
      const { agent, key } = await mintedSession();
      await backdate(key, ANONYMOUS_SESSION_MAX_AGE_MS + 1000);

      const res = await agent.get('/auth/me');

      expect(res.status).toBe(401);
      expect(await valkey.exists(key)).toBe(0);
      expect(await valkey.exists(sessionKeyFrom(res))).toBe(0);
    });

    it('keeps a signed-in session to the idle timeout and its 24h cap', async () => {
      const valkey = app.get<IORedis>(VALKEY_CLIENT);
      const { agent, memberId } = await seedSignedInMember(app);
      const key = await findSessionKey(valkey, memberId);
      await backdate(key, 2 * ANONYMOUS_SESSION_MAX_AGE_MS);

      await withClockAhead(ANONYMOUS_SESSION_MAX_AGE_MS - 60_000, () =>
        agent.get('/auth/me').expect(200),
      );
      expect(await valkey.pttl(key)).toBeGreaterThan((SESSION_IDLE_TTL_SECONDS - 5) * 1000);

      await backdate(key, SESSION_MAX_AGE_MS);
      const minted = await agent.get('/auth/csrf-token').expect(200);
      expect(sessionKeyFrom(minted)).not.toBe(key);
      expect(await valkey.exists(key)).toBe(0);
      await agent.get('/auth/me').expect(401);
    });

    it('lifts the anonymous cap on sign-in, keeping the clock of the session first stored', async () => {
      const valkey = app.get<IORedis>(VALKEY_CLIENT);
      const { agent, key } = await mintedSession();
      // Near the end of its anonymous cap, with time left for the ceremony.
      const createdAt = await backdate(key, ANONYMOUS_SESSION_MAX_AGE_MS - 20_000);
      const { memberId, credentialId } = await insertMemberWithCredential(app);

      await signInWithPasskey(app, agent, credentialId);

      const signedInKey = await findSessionKey(valkey, memberId);
      expect(signedInKey).not.toBe(key);
      expect((await storedSession(signedInKey)).createdAt).toBe(createdAt);
      expect(await valkey.pttl(signedInKey)).toBeGreaterThan((SESSION_IDLE_TTL_SECONDS - 5) * 1000);
      await withClockAhead(60_000, () => agent.get('/auth/me').expect(200));
    });
  });

  // A request in flight when its session is revoked writes the session back
  // when it ends; dropped from the registry, it must stay signed out.
  it('rejects a revoked session written back to the store', async () => {
    const { agent, memberId } = await seedSignedInMember(app);
    const valkey = app.get<IORedis>(VALKEY_CLIENT);
    const key = await findSessionKey(valkey, memberId);
    const raw = await valkey.get(key);

    await app.get(SessionRegistryService).revokeOthers(memberId);
    await valkey.set(key, raw!);

    await agent.get('/auth/me').expect(401);
  });

  async function bumpSessionEpoch(memberId: string): Promise<number> {
    const [row] = await getDb(app)
      .update(member)
      .set({ sessionEpoch: sql`${member.sessionEpoch} + 1` })
      .where(eq(member.id, memberId))
      .returning({ sessionEpoch: member.sessionEpoch });
    return row.sessionEpoch;
  }

  // Revocation that never reached Valkey: still registered, but over.
  it("rejects a registered session from before the member's session epoch", async () => {
    const { agent, memberId } = await seedSignedInMember(app);
    await agent.get('/auth/me').expect(200);

    await bumpSessionEpoch(memberId);

    await agent.get('/auth/me').expect(401);
  });

  it("signs in under the member's current session epoch", async () => {
    const { memberId, credentialId } = await insertMemberWithCredential(app);
    const epoch = await bumpSessionEpoch(memberId);
    const agent = request.agent(app.getHttpServer());

    await signInWithPasskey(app, agent, credentialId);

    await agent.get('/auth/me').expect(200);
    const valkey = app.get<IORedis>(VALKEY_CLIENT);
    const stored = JSON.parse(
      (await valkey.get(await findSessionKey(valkey, memberId)))!,
    ) as StoredSession;
    expect(stored.sessionEpoch).toBe(epoch);
  });

  // Sessions stored before the epoch existed carry none.
  it('keeps a session without an epoch while the member has never been bumped', async () => {
    const { agent, memberId } = await seedSignedInMember(app);
    const valkey = app.get<IORedis>(VALKEY_CLIENT);
    const key = await findSessionKey(valkey, memberId);
    const data = JSON.parse((await valkey.get(key))!) as StoredSession;
    delete data.sessionEpoch;
    await valkey.set(key, JSON.stringify(data));

    await agent.get('/auth/me').expect(200);
    await bumpSessionEpoch(memberId);
    await agent.get('/auth/me').expect(401);
  });

  it("lets SessionAuthGuard reject an unauthenticated request before RateLimitGuard ever runs (app.module.ts's SessionModule-before-SecurityModule ordering)", async () => {
    // webauthn/registration/options requires auth and carries its own
    // @RateLimit({ points: 10, ... }) — if SecurityModule's guard ran
    // first, the 11th+ of these would 429 instead of 401.
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);

    for (let i = 0; i < 15; i++) {
      await agent.post('/webauthn/registration/options').set('x-csrf-token', csrfToken).expect(401);
    }
  });
});

import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Server } from 'http';
import request from 'supertest';
import type { Locale } from '../common/locale';
import { member } from '../db/schema';
import { buildActivationToken } from '../members/activation-token';
import { CryptoService } from '../security/crypto.service';
import { HashService } from '../security/hash.service';
import { getDb } from './create-test-app';

// Postgres/Valkey are shared for the whole `--runInBand` run (one
// Testcontainer pair, see integration-infra.ts) — every spec gets
// isolation from a unique identifier per call, never from cleanup between
// tests or a fixed literal that could collide with another file.
export function uniqueEmail(label = 'member'): string {
  return `${label}-${randomUUID()}@example.test`;
}

export const DEFAULT_PASSWORD = 'correct horse battery staple';

type Agent = ReturnType<typeof request.agent>;
type MutateMethod = 'post' | 'patch' | 'put' | 'delete';
// supertest's Test is itself thenable (PromiseLike<Response>) — an async
// function returning one gets auto-flattened to Promise<Response> by plain
// JS await semantics, not a typing quirk. So `mutate` below resolves the
// request fully (optionally send()ing a body first) rather than handing
// back a Test for the caller to chain .send()/.expect() onto.
type SupertestResponse = Awaited<ReturnType<Agent['get']>>;

export interface SignedInFixture {
  agent: Agent;
  email: string;
  password: string;
  memberId: string;
  /**
   * GETs a fresh CSRF token for this session — echo it back via the
   * `x-csrf-token` header on every mutating call, same as
   * apps/web/src/api/client.ts.
   *
   * Prefer `mutate()` below over calling this directly: supertest's agent
   * snapshots the cookie jar synchronously the moment `.post(url)` is
   * called, not when the request is later awaited, so `agent.post(url)
   * .set('x-csrf-token', await getCsrfToken())` calls `.post(url)` first
   * (freezing the *current* cookies) and resolves the token after — the
   * very GET this makes can itself rotate the csrf cookie, leaving the
   * frozen request with a mismatched pair and a spurious 403.
   */
  getCsrfToken: () => Promise<string>;
  /**
   * The CSRF-safe way to make a mutating request: resolves a fresh token
   * *before* constructing it, so the ordering hazard above can't happen,
   * then sends `body` (if given) and awaits the full response. Usage:
   * `const res = await mutate('post', '/banks/choice', { name: 'X' });
   * expect(res.status).toBe(200);` — plain `res.status`/`res.body`
   * checks rather than supertest's `.expect(...)` chaining, since a Test
   * is thenable and would otherwise auto-flatten to a Response the
   * moment it crosses this function's own `await` boundary anyway.
   */
  mutate: (method: MutateMethod, url: string, body?: object) => Promise<SupertestResponse>;
}

/** Exposed for specs that drive their own raw supertest calls (e.g. sign-in's own failure-mode cases) instead of going through a fixture above. */
export async function csrfTokenFor(agent: Agent): Promise<string> {
  const res = await agent.get('/auth/csrf-token').expect(200);
  return (res.body as { csrfToken: string }).csrfToken;
}

function buildMutate(
  agent: Agent,
  getCsrfToken: () => Promise<string>,
): (method: MutateMethod, url: string, body?: object) => Promise<SupertestResponse> {
  return async (method, url, body) => {
    const token = await getCsrfToken();
    const req = agent[method](url).set('x-csrf-token', token);
    return body === undefined ? req : req.send(body);
  };
}

interface FixtureOverrides {
  email?: string;
  password?: string;
  country?: string;
  locale?: Locale;
}

/**
 * Inserts an already-active member directly via Drizzle with a real,
 * known password hash — no HTTP, no session. The building block behind
 * `seedSignedInMember`; exposed separately for specs (sign-in itself,
 * resend-activation, change-password, password-recovery) that need to
 * drive the sign-in/credential-check HTTP call themselves rather than
 * getting an already-authenticated agent back.
 */
export async function insertActiveMember(
  app: INestApplication<Server>,
  overrides: FixtureOverrides = {},
): Promise<{ email: string; password: string; memberId: string }> {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? DEFAULT_PASSWORD;
  const country = overrides.country ?? 'FR';
  const passwordHash = await app.get(HashService).hash(password);
  const values: typeof member.$inferInsert = {
    email,
    password: passwordHash,
    country,
    active: true,
  };
  if (overrides.locale) {
    values.locale = overrides.locale;
  }
  const [row] = await getDb(app).insert(member).values(values).returning({ id: member.id });

  return { email, password, memberId: row.id };
}

/**
 * Drives the real HTTP funnel: register → mint a valid activation token
 * directly (no email round trip — see create-test-app.ts's fake email
 * queue) → activate → sign in. Reserved for the members/auth tier itself,
 * which needs to prove the funnel works; every other tier should use
 * `seedSignedInMember` instead.
 */
export async function registerActivateAndSignIn(
  app: INestApplication<Server>,
  overrides: FixtureOverrides = {},
): Promise<SignedInFixture> {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? DEFAULT_PASSWORD;
  const country = overrides.country ?? 'FR';
  const agent = request.agent(app.getHttpServer());

  // One token, fetched once: register/activate/sign-in all run against the
  // same pre-rotation session id (sign-in only rotates it *after* this
  // request's own CSRF check has already passed), so a single fetch here
  // covers every POST below. A caller needing a mutating call afterward
  // must fetch its own via getCsrfToken() — sign-in rotates the session id,
  // which invalidates this token for anything past this point.
  const csrfToken = await csrfTokenFor(agent);

  await agent
    .post('/members/register')
    .set('x-csrf-token', csrfToken)
    .send({ email, password, passwordConfirmation: password, country })
    .expect(201);

  const db = getDb(app);
  const [row] = await db.select().from(member).where(eq(member.email, email));
  const key = buildActivationToken(app.get(CryptoService), email, row.activationTokenVersion);
  await agent.post('/members/activate').set('x-csrf-token', csrfToken).send({ key }).expect(200);
  await agent
    .post('/auth/sign-in')
    .set('x-csrf-token', csrfToken)
    .send({ email, password })
    .expect(200);

  const getCsrfToken = () => csrfTokenFor(agent);
  return {
    agent,
    email,
    password,
    memberId: row.id,
    getCsrfToken,
    mutate: buildMutate(agent, getCsrfToken),
  };
}

/**
 * Fast path for every tier other than members/auth itself: inserts an
 * already-active member directly via Drizzle, then drives only the real
 * sign-in call for a real cookie/session.
 */
export async function seedSignedInMember(
  app: INestApplication<Server>,
  overrides: FixtureOverrides = {},
): Promise<SignedInFixture> {
  const { email, password, memberId } = await insertActiveMember(app, overrides);

  const agent = request.agent(app.getHttpServer());
  const csrfToken = await csrfTokenFor(agent);
  await agent
    .post('/auth/sign-in')
    .set('x-csrf-token', csrfToken)
    .send({ email, password })
    .expect(200);

  const getCsrfToken = () => csrfTokenFor(agent);
  return {
    agent,
    email,
    password,
    memberId,
    getCsrfToken,
    mutate: buildMutate(agent, getCsrfToken),
  };
}

import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import type {
  VerifiedAuthenticationResponse,
  VerifiedRegistrationResponse,
} from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import type { Server } from 'http';
import request from 'supertest';
import type { Locale } from '../common/locale';
import { member, webauthnCredential } from '../db/schema';
import { buildSignupToken } from '../members/signup-token';
import { CryptoService } from '../security/crypto.service';
import { WebauthnCryptoService } from '../webauthn/webauthn-crypto.service';
import { getDb } from './create-test-app';

// Postgres/Valkey are shared for the whole `--runInBand` run (one
// Testcontainer pair, see integration-infra.ts) — every spec gets
// isolation from a unique identifier per call, never from cleanup between
// tests or a fixed literal that could collide with another file.
export function uniqueEmail(label = 'member'): string {
  return `${label}-${randomUUID()}@example.test`;
}

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
  memberId: string;
  /** The credential id backing this session's own passkey — for specs that need to drive a step-up ceremony (see `completeStepUp`). */
  credentialId: string;
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

/** Exposed for specs that drive their own raw supertest calls instead of going through a fixture above. */
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
  country?: string;
  locale?: Locale;
}

/** A fake but well-formed COSE public key — never actually verified for the fixtures below, since verifyAuthenticationResponse itself is stubbed. */
function fakePublicKey(): Buffer {
  return Buffer.from([1, 2, 3]);
}

function fakeAuthenticationResponseFor(credentialId: string) {
  return {
    id: credentialId,
    rawId: credentialId,
    response: {},
    clientExtensionResults: {},
    type: 'public-key',
  };
}

function verifiedAuthentication(newCounter = 1): VerifiedAuthenticationResponse {
  return {
    verified: true,
    authenticationInfo: { newCounter },
  } as unknown as VerifiedAuthenticationResponse;
}

/**
 * Inserts a member row and one passkey directly via Drizzle — no HTTP, no
 * crypto. The building block behind `seedSignedInMember`; exposed
 * separately for specs that need a real member/credential pair without an
 * authenticated agent (e.g. webauthn-authentication's own ownership/
 * anti-enumeration cases).
 */
export async function insertMemberWithCredential(
  app: INestApplication<Server>,
  overrides: FixtureOverrides = {},
): Promise<{ email: string; memberId: string; credentialId: string }> {
  const email = overrides.email ?? uniqueEmail();
  const country = overrides.country ?? 'FR';
  const credentialId = `cred-${randomUUID()}`;

  const values: typeof member.$inferInsert = { email, country };
  if (overrides.locale) {
    values.locale = overrides.locale;
  }
  const [row] = await getDb(app).insert(member).values(values).returning({ id: member.id });
  await getDb(app)
    .insert(webauthnCredential)
    .values({
      memberId: row.id,
      credentialId,
      publicKey: fakePublicKey().toString('base64'),
      counter: 0,
    });

  return { email, memberId: row.id, credentialId };
}

/**
 * Drives the real `/webauthn/authentication` HTTP funnel for an
 * already-inserted member/credential pair, stubbing only
 * `WebauthnCryptoService.verifyAuthenticationResponse` — the one step that
 * would otherwise need a real authenticator-held private key — via
 * `jest.spyOn` on the app's own DI-resolved instance. `mockResolvedValueOnce`
 * queues exactly one canned success for this one verify() call, so this
 * needs no cleanup/reset between fixture calls or spec files.
 */
export async function signInWithPasskey(
  app: INestApplication<Server>,
  agent: Agent,
  email: string,
  credentialId: string,
): Promise<void> {
  const csrfToken = await csrfTokenFor(agent);
  await agent
    .post('/webauthn/authentication/options')
    .set('x-csrf-token', csrfToken)
    .send({ email })
    .expect(200);

  jest
    .spyOn(app.get(WebauthnCryptoService), 'verifyAuthenticationResponse')
    .mockResolvedValueOnce(verifiedAuthentication());
  await agent
    .post('/webauthn/authentication/verify')
    .set('x-csrf-token', csrfToken)
    .send({ response: fakeAuthenticationResponseFor(credentialId) })
    .expect(200);
}

/**
 * Fast path for every tier other than members/auth/webauthn itself: inserts
 * an already-usable member with one passkey directly via Drizzle, then
 * drives only the real sign-in ceremony (crypto stubbed, see
 * `signInWithPasskey`) for a real cookie/session.
 */
export async function seedSignedInMember(
  app: INestApplication<Server>,
  overrides: FixtureOverrides = {},
): Promise<SignedInFixture> {
  const { email, memberId, credentialId } = await insertMemberWithCredential(app, overrides);

  const agent = request.agent(app.getHttpServer());
  await signInWithPasskey(app, agent, email, credentialId);

  const getCsrfToken = () => csrfTokenFor(agent);
  return {
    agent,
    email,
    memberId,
    credentialId,
    getCsrfToken,
    mutate: buildMutate(agent, getCsrfToken),
  };
}

/**
 * Drives the real `/webauthn/step-up` ceremony for an already-signed-in
 * fixture, stubbing `WebauthnCryptoService.verifyAuthenticationResponse`
 * the same way `signInWithPasskey` does — the passkey-era analog of
 * "submit the current password" wherever a mutation needs step-up proof
 * (see ProfileService.updateEmail).
 */
export async function completeStepUp(
  app: INestApplication<Server>,
  fixture: Pick<SignedInFixture, 'agent' | 'credentialId' | 'getCsrfToken'>,
): Promise<void> {
  const csrfToken = await fixture.getCsrfToken();
  await fixture.agent.post('/webauthn/step-up/options').set('x-csrf-token', csrfToken).expect(200);

  jest
    .spyOn(app.get(WebauthnCryptoService), 'verifyAuthenticationResponse')
    .mockResolvedValueOnce(verifiedAuthentication());
  await fixture.agent
    .post('/webauthn/step-up/verify')
    .set('x-csrf-token', csrfToken)
    .send({ response: fakeAuthenticationResponseFor(fixture.credentialId) })
    .expect(200);
}

/**
 * Drives the real end-to-end funnel: register → mint a valid sign-up token
 * directly (no email round trip — see create-test-app.ts's fake email
 * queue) → the `/webauthn/signup` options/verify ceremony (crypto stubbed
 * the same way `signInWithPasskey` stubs it, but on the registration side)
 * → lands signed in. Reserved for the members/auth/webauthn tier itself,
 * which needs to prove the funnel works; every other tier should use
 * `seedSignedInMember` instead.
 */
export async function registerAndCompleteSignup(
  app: INestApplication<Server>,
  overrides: FixtureOverrides = {},
): Promise<SignedInFixture> {
  const email = overrides.email ?? uniqueEmail();
  const country = overrides.country ?? 'FR';
  const locale = overrides.locale ?? 'en';
  const credentialId = `cred-${randomUUID()}`;

  const key = buildSignupToken(app.get(CryptoService), email, country, locale);

  const agent = request.agent(app.getHttpServer());
  const csrfToken = await csrfTokenFor(agent);

  await agent
    .post('/webauthn/signup/options')
    .set('x-csrf-token', csrfToken)
    .send({ key })
    .expect(200);

  jest.spyOn(app.get(WebauthnCryptoService), 'verifyRegistrationResponse').mockResolvedValueOnce({
    verified: true,
    registrationInfo: {
      credential: { id: credentialId, publicKey: fakePublicKey(), counter: 0 },
    },
  } as unknown as VerifiedRegistrationResponse);
  await agent
    .post('/webauthn/signup/verify')
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

  const [row] = await getDb(app).select().from(member).where(eq(member.email, email));

  const getCsrfToken = () => csrfTokenFor(agent);
  return {
    agent,
    email,
    memberId: row.id,
    credentialId,
    getCsrfToken,
    mutate: buildMutate(agent, getCsrfToken),
  };
}

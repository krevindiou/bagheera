import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
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

// Postgres/Valkey are shared by the whole run: isolation comes from unique
// identifiers, never from cleanup between tests.
export function uniqueEmail(label = 'member'): string {
  return `${label}-${randomUUID()}@example.test`;
}

type Agent = ReturnType<typeof request.agent>;
type MutateMethod = 'post' | 'patch' | 'put' | 'delete';
// A supertest Test is thenable, so `mutate` resolves to the Response itself.
type SupertestResponse = Awaited<ReturnType<Agent['get']>>;

export interface SignedInFixture {
  agent: Agent;
  email: string;
  memberId: string;
  /** The credential id backing this session's own passkey — for specs that need to drive a step-up ceremony (see `completeStepUp`). */
  credentialId: string;
  /**
   * GETs a fresh CSRF token for this session. Resolve it *before* calling
   * `agent.post(url)`, or prefer `mutate()`: the agent snapshots its cookie
   * jar at `.post(url)`, and this GET can rotate the CSRF cookie, giving a
   * spurious 403.
   */
  getCsrfToken: () => Promise<string>;
  /**
   * A mutating request with a fresh CSRF token, resolved in the safe order.
   * Assert on `res.status`/`res.body`; there's no `.expect()` chaining.
   */
  mutate: (method: MutateMethod, url: string, body?: object) => Promise<SupertestResponse>;
}

/** For specs driving raw supertest calls. */
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
 * Inserts a member and one passkey straight in the database, without
 * signing in.
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
 * Drives the real sign-in ceremony, stubbing only
 * `verifyAuthenticationResponse` (which needs a real authenticator), once.
 */
export async function signInWithPasskey(
  app: INestApplication<Server>,
  agent: Agent,
  credentialId: string,
): Promise<void> {
  const csrfToken = await csrfTokenFor(agent);
  await agent.post('/webauthn/authentication/options').set('x-csrf-token', csrfToken).expect(200);

  vi.spyOn(app.get(WebauthnCryptoService), 'verifyAuthenticationResponse').mockResolvedValueOnce(
    verifiedAuthentication(),
  );
  await agent
    .post('/webauthn/authentication/verify')
    .set('x-csrf-token', csrfToken)
    .send({ response: fakeAuthenticationResponseFor(credentialId) })
    .expect(200);
}

/**
 * A signed-in member: inserted directly, then signed in for a real session.
 * What every spec outside members/auth/webauthn should use.
 */
export async function seedSignedInMember(
  app: INestApplication<Server>,
  overrides: FixtureOverrides = {},
): Promise<SignedInFixture> {
  const { email, memberId, credentialId } = await insertMemberWithCredential(app, overrides);

  const agent = request.agent(app.getHttpServer());
  await signInWithPasskey(app, agent, credentialId);

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

/** Drives the real step-up ceremony, stubbed like `signInWithPasskey`. */
export async function completeStepUp(
  app: INestApplication<Server>,
  fixture: Pick<SignedInFixture, 'agent' | 'credentialId' | 'getCsrfToken'>,
): Promise<void> {
  const csrfToken = await fixture.getCsrfToken();
  await fixture.agent.post('/webauthn/step-up/options').set('x-csrf-token', csrfToken).expect(200);

  vi.spyOn(app.get(WebauthnCryptoService), 'verifyAuthenticationResponse').mockResolvedValueOnce(
    verifiedAuthentication(),
  );
  await fixture.agent
    .post('/webauthn/step-up/verify')
    .set('x-csrf-token', csrfToken)
    .send({ response: fakeAuthenticationResponseFor(fixture.credentialId) })
    .expect(200);
}

/**
 * The real sign-up funnel from a directly minted token (no email round
 * trip), registration crypto stubbed, ending signed in. For the
 * members/auth/webauthn specs; others use `seedSignedInMember`.
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

  vi.spyOn(app.get(WebauthnCryptoService), 'verifyRegistrationResponse').mockResolvedValueOnce({
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

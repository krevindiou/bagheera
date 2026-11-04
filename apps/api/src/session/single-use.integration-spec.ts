import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import type {
  VerifiedAuthenticationResponse,
  VerifiedRegistrationResponse,
} from '@simplewebauthn/server';
import { eq, inArray } from 'drizzle-orm';
import type { Server } from 'http';
import type IORedis from 'ioredis';
import request from 'supertest';
import { vi } from 'vitest';
import { webauthnCredential } from '../db/schema';
import { buildSignupToken } from '../members/signup-token';
import { CryptoService } from '../security/crypto.service';
import {
  completeStepUp,
  csrfTokenFor,
  insertMemberWithCredential,
  seedSignedInMember,
  SignedInFixture,
  uniqueEmail,
} from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';
import { WebauthnCryptoService } from '../webauthn/webauthn-crypto.service';
import { CHALLENGE_TTL_MS } from './challenge';
import { STEP_UP_TTL_MS } from './consume-step-up';
import { SESSION_KEY_PREFIX, VALKEY_CLIENT } from './session.constants';
import { singleUseKey } from './single-use-store';

function fakeResponseFor(credentialId: string) {
  return {
    id: credentialId,
    rawId: credentialId,
    response: {},
    clientExtensionResults: {},
    type: 'public-key',
  };
}

function verifiedRegistration(credentialId: string): VerifiedRegistrationResponse {
  return {
    verified: true,
    registrationInfo: {
      credential: { id: credentialId, publicKey: Buffer.from([1, 2, 3]), counter: 0 },
    },
  } as unknown as VerifiedRegistrationResponse;
}

function verifiedAuthentication(): VerifiedAuthenticationResponse {
  return {
    verified: true,
    authenticationInfo: { newCounter: 1 },
  } as unknown as VerifiedAuthenticationResponse;
}

function statuses(responses: request.Response[]): number[] {
  return responses.map((res) => res.status).sort((a, b) => a - b);
}

// Overlapping requests on one session each load it before any of them
// writes it back: a value spent in the session itself would be spent by
// each of them.
describe('single-use session state', () => {
  let app: INestApplication<Server>;
  let valkey: IORedis;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    valkey = app.get<IORedis>(VALKEY_CLIENT);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function sessionIdOf(memberId: string): Promise<string> {
    const [sessionId] = await valkey.smembers(`member:${memberId}:sessions`);
    return sessionId;
  }

  async function insertCredential(memberId: string) {
    const [row] = await getDb(app)
      .insert(webauthnCredential)
      .values({
        memberId,
        credentialId: `cred-${randomUUID()}`,
        publicKey: Buffer.from([1, 2, 3]).toString('base64'),
      })
      .returning();
    return row;
  }

  async function concurrently(
    fixture: SignedInFixture,
    calls: ((csrfToken: string) => request.Test)[],
  ): Promise<request.Response[]> {
    const csrfToken = await fixture.getCsrfToken();
    return Promise.all(calls.map(async (call) => call(csrfToken)));
  }

  describe('step-up proof', () => {
    it('lets only one of two simultaneous email changes spend one proof', async () => {
      const fixture = await seedSignedInMember(app);
      await completeStepUp(app, fixture);

      const change = (csrfToken: string) =>
        fixture.agent
          .post('/members/profile')
          .set('x-csrf-token', csrfToken)
          .send({ email: uniqueEmail() });
      const responses = await concurrently(fixture, [change, change]);

      expect(statuses(responses)).toEqual([200, 422]);
    });

    it('lets only one of two simultaneous registration ceremonies start from one proof', async () => {
      const fixture = await seedSignedInMember(app);
      await completeStepUp(app, fixture);

      const options = (csrfToken: string) =>
        fixture.agent.post('/webauthn/registration/options').set('x-csrf-token', csrfToken);
      const responses = await concurrently(fixture, [options, options]);

      expect(statuses(responses)).toEqual([200, 422]);
    });

    it('lets only one of three different sensitive actions through on one proof', async () => {
      const fixture = await seedSignedInMember(app);
      const spare = await insertCredential(fixture.memberId);
      await completeStepUp(app, fixture);

      const responses = await concurrently(fixture, [
        (csrfToken) =>
          fixture.agent.post('/webauthn/registration/options').set('x-csrf-token', csrfToken),
        (csrfToken) =>
          fixture.agent
            .post('/members/profile')
            .set('x-csrf-token', csrfToken)
            .send({ email: uniqueEmail() }),
        (csrfToken) =>
          fixture.agent.delete(`/webauthn/credentials/${spare.id}`).set('x-csrf-token', csrfToken),
      ]);

      expect(statuses(responses)).toEqual([200, 422, 422]);
      for (const res of responses.filter((r) => r.status === 422)) {
        expect((res.body as { code: string }).code).toBe('step_up_required');
      }
    });

    // A request that loaded the session while the proof was live writes it
    // back when it ends, after the proof was spent.
    it('stays spent when an older copy of the session is written back', async () => {
      const fixture = await seedSignedInMember(app);
      await completeStepUp(app, fixture);
      const sessionKey = `${SESSION_KEY_PREFIX}${await sessionIdOf(fixture.memberId)}`;
      const snapshot = await valkey.get(sessionKey);
      expect(snapshot).not.toBeNull();

      const first = await fixture.mutate('post', '/members/profile', { email: uniqueEmail() });
      expect(first.status).toBe(200);
      await valkey.set(sessionKey, snapshot!);

      const second = await fixture.mutate('post', '/members/profile', { email: uniqueEmail() });
      expect(second.status).toBe(422);
      expect((second.body as { code: string }).code).toBe('step_up_required');
    });

    it('grants a single proof from two simultaneous answers to one step-up challenge', async () => {
      const fixture = await seedSignedInMember(app);
      const csrfToken = await fixture.getCsrfToken();
      await fixture.agent
        .post('/webauthn/step-up/options')
        .set('x-csrf-token', csrfToken)
        .expect(200);

      const verifySpy = vi
        .spyOn(app.get(WebauthnCryptoService), 'verifyAuthenticationResponse')
        .mockResolvedValue(verifiedAuthentication());
      verifySpy.mockClear();
      const answer = () =>
        fixture.agent
          .post('/webauthn/step-up/verify')
          .set('x-csrf-token', csrfToken)
          .send({ response: fakeResponseFor(fixture.credentialId) });
      const responses = await Promise.all([answer(), answer()]);

      expect(statuses(responses)).toEqual([200, 422]);
      expect(verifySpy).toHaveBeenCalledTimes(1);
      expect((await fixture.mutate('post', '/webauthn/registration/options')).status).toBe(200);
      expect((await fixture.mutate('post', '/webauthn/registration/options')).status).toBe(422);
    });

    it('keeps a proof and a challenge no longer than their own lifetime', async () => {
      const fixture = await seedSignedInMember(app);
      const sessionId = await sessionIdOf(fixture.memberId);
      expect((await fixture.mutate('post', '/webauthn/step-up/options')).status).toBe(200);

      const challengeTtl = await valkey.pttl(singleUseKey(sessionId, 'stepUpChallenge'));
      expect(challengeTtl).toBeGreaterThan(0);
      expect(challengeTtl).toBeLessThanOrEqual(CHALLENGE_TTL_MS);

      await completeStepUp(app, fixture);
      const proofTtl = await valkey.pttl(singleUseKey(sessionId, 'stepUpProof'));
      expect(proofTtl).toBeGreaterThan(0);
      expect(proofTtl).toBeLessThanOrEqual(STEP_UP_TTL_MS);

      // Signing out leaves the proof unreachable; its TTL still bounds it.
      expect((await fixture.mutate('post', '/auth/sign-out')).status).toBe(200);
      const orphanTtl = await valkey.pttl(singleUseKey(sessionId, 'stepUpProof'));
      expect(orphanTtl).toBeGreaterThan(0);
      expect(orphanTtl).toBeLessThanOrEqual(STEP_UP_TTL_MS);
    });
  });

  describe('ceremony challenges', () => {
    it('registers one passkey from two simultaneous answers to one registration challenge', async () => {
      const fixture = await seedSignedInMember(app);
      await completeStepUp(app, fixture);
      expect((await fixture.mutate('post', '/webauthn/registration/options')).status).toBe(200);

      const credentialIds = [`cred-${randomUUID()}`, `cred-${randomUUID()}`];
      vi.spyOn(app.get(WebauthnCryptoService), 'verifyRegistrationResponse')
        .mockResolvedValueOnce(verifiedRegistration(credentialIds[0]))
        .mockResolvedValueOnce(verifiedRegistration(credentialIds[1]));
      const responses = await concurrently(
        fixture,
        credentialIds.map(
          (credentialId) => (csrfToken: string) =>
            fixture.agent
              .post('/webauthn/registration/verify')
              .set('x-csrf-token', csrfToken)
              .send({ response: fakeResponseFor(credentialId) }),
        ),
      );

      expect(statuses(responses)).toEqual([200, 400]);
      const planted = await getDb(app)
        .select()
        .from(webauthnCredential)
        .where(inArray(webauthnCredential.credentialId, credentialIds));
      expect(planted).toHaveLength(1);
    });

    // Read before the session id rotates, or sign-in could never find it.
    it('signs in once from two simultaneous answers to one sign-in challenge', async () => {
      const { credentialId } = await insertMemberWithCredential(app);
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);
      await agent
        .post('/webauthn/authentication/options')
        .set('x-csrf-token', csrfToken)
        .expect(200);

      const verifySpy = vi
        .spyOn(app.get(WebauthnCryptoService), 'verifyAuthenticationResponse')
        .mockResolvedValue(verifiedAuthentication());
      verifySpy.mockClear();
      const answer = () =>
        agent
          .post('/webauthn/authentication/verify')
          .set('x-csrf-token', csrfToken)
          .send({ response: fakeResponseFor(credentialId) });
      const responses = await Promise.all([answer(), answer()]);

      expect(statuses(responses)).toEqual([200, 401]);
      expect(verifySpy).toHaveBeenCalledTimes(1);
    });

    it('checks one attestation from two simultaneous answers to one sign-up challenge', async () => {
      const email = uniqueEmail('signup');
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);
      const key = buildSignupToken(app.get(CryptoService), email, 'FR', 'en');
      await agent
        .post('/webauthn/signup/options')
        .set('x-csrf-token', csrfToken)
        .send({ key })
        .expect(200);

      const credentialId = `cred-${randomUUID()}`;
      const verifySpy = vi
        .spyOn(app.get(WebauthnCryptoService), 'verifyRegistrationResponse')
        .mockResolvedValue(verifiedRegistration(credentialId));
      verifySpy.mockClear();
      const answer = () =>
        agent
          .post('/webauthn/signup/verify')
          .set('x-csrf-token', csrfToken)
          .send({ response: fakeResponseFor(credentialId) });
      const responses = await Promise.all([answer(), answer()]);

      expect(statuses(responses)).toEqual([200, 400]);
      expect(verifySpy).toHaveBeenCalledTimes(1);
      const created = await getDb(app)
        .select()
        .from(webauthnCredential)
        .where(eq(webauthnCredential.credentialId, credentialId));
      expect(created).toHaveLength(1);
    });
  });
});

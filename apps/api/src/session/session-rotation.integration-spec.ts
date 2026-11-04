import { INestApplication } from '@nestjs/common';
import { vi } from 'vitest';
import type { Server } from 'http';
import type { VerifiedRegistrationResponse } from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { webauthnCredential } from '../db/schema';
import { buildSignupToken } from '../members/signup-token';
import { CryptoService } from '../security/crypto.service';
import {
  completeStepUp,
  csrfTokenFor,
  insertMemberWithCredential,
  seedSignedInMember,
  signInWithPasskey,
  uniqueEmail,
} from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';
import { WebauthnCryptoService } from '../webauthn/webauthn-crypto.service';

type Agent = ReturnType<typeof request.agent>;

function verifiedRegistration(credentialId: string): VerifiedRegistrationResponse {
  return {
    verified: true,
    registrationInfo: {
      credential: { id: credentialId, publicKey: Buffer.from([1, 2, 3]), counter: 0 },
    },
  } as unknown as VerifiedRegistrationResponse;
}

function fakeResponseFor(credentialId: string) {
  return {
    id: credentialId,
    rawId: credentialId,
    response: {},
    clientExtensionResults: {},
    type: 'public-key',
  };
}

function codeOf(res: request.Response): string {
  return (res.body as { code: string }).code;
}

// One browser shared by two members: whatever the first left in the session
// must not act on the account signed in after them.
describe('session rotation across identities', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  async function post(agent: Agent, url: string, body?: object) {
    const csrfToken = await csrfTokenFor(agent);
    const req = agent.post(url).set('x-csrf-token', csrfToken);
    return body === undefined ? req : req.send(body);
  }

  // Stubbed to succeed, so only the missing challenge can refuse it.
  async function verifyRegistration(agent: Agent, credentialId: string) {
    const spy = vi
      .spyOn(app.get(WebauthnCryptoService), 'verifyRegistrationResponse')
      .mockResolvedValue(verifiedRegistration(credentialId));
    try {
      return await post(agent, '/webauthn/registration/verify', {
        response: fakeResponseFor(credentialId),
      });
    } finally {
      spy.mockRestore();
    }
  }

  async function plantedCredentials(credentialId: string) {
    return getDb(app)
      .select()
      .from(webauthnCredential)
      .where(eq(webauthnCredential.credentialId, credentialId));
  }

  async function signedInEmail(agent: Agent): Promise<string> {
    const res = await agent.get('/auth/me').expect(200);
    return (res.body as { email: string }).email;
  }

  async function signUp(agent: Agent): Promise<string> {
    const email = uniqueEmail('signup');
    const credentialId = `cred-${email}`;
    const key = buildSignupToken(app.get(CryptoService), email, 'FR', 'en');
    expect((await post(agent, '/webauthn/signup/options', { key })).status).toBe(200);

    vi.spyOn(app.get(WebauthnCryptoService), 'verifyRegistrationResponse').mockResolvedValueOnce(
      verifiedRegistration(credentialId),
    );
    const res = await post(agent, '/webauthn/signup/verify', {
      response: fakeResponseFor(credentialId),
    });
    expect(res.status).toBe(200);
    return email;
  }

  describe('on sign-in', () => {
    it("drops the previous member's step-up proof", async () => {
      const x = await seedSignedInMember(app);
      await completeStepUp(app, x);
      const y = await insertMemberWithCredential(app);
      await signInWithPasskey(app, x.agent, y.credentialId);
      expect(await signedInEmail(x.agent)).toBe(y.email);

      const options = await post(x.agent, '/webauthn/registration/options');
      expect(options.status).toBe(422);
      expect(codeOf(options)).toBe('step_up_required');

      const credentialId = `cred-planted-${y.memberId}`;
      const verify = await verifyRegistration(x.agent, credentialId);
      expect(verify.status).toBe(400);
      expect(await plantedCredentials(credentialId)).toEqual([]);
    });

    it("drops the previous member's pending registration challenge", async () => {
      const x = await seedSignedInMember(app);
      await completeStepUp(app, x);
      expect((await post(x.agent, '/webauthn/registration/options')).status).toBe(200);
      const y = await insertMemberWithCredential(app);
      await signInWithPasskey(app, x.agent, y.credentialId);

      const credentialId = `cred-planted-${y.memberId}`;
      const verify = await verifyRegistration(x.agent, credentialId);
      expect(verify.status).toBe(400);
      expect(await plantedCredentials(credentialId)).toEqual([]);
    });

    it("refuses an email change on the new member with the previous member's step-up", async () => {
      const x = await seedSignedInMember(app);
      await completeStepUp(app, x);
      const y = await insertMemberWithCredential(app);
      await signInWithPasskey(app, x.agent, y.credentialId);

      const res = await post(x.agent, '/members/profile', { email: uniqueEmail() });
      expect(res.status).toBe(422);
      expect(codeOf(res)).toBe('step_up_required');
    });

    it('still lets the new member step up and register their own passkey', async () => {
      const x = await seedSignedInMember(app);
      await completeStepUp(app, x);
      const y = await insertMemberWithCredential(app);
      await signInWithPasskey(app, x.agent, y.credentialId);

      await completeStepUp(app, {
        agent: x.agent,
        credentialId: y.credentialId,
        getCsrfToken: () => csrfTokenFor(x.agent),
      });
      expect((await post(x.agent, '/webauthn/registration/options')).status).toBe(200);

      const credentialId = `cred-own-${y.memberId}`;
      const verify = await verifyRegistration(x.agent, credentialId);
      expect(verify.status).toBe(200);
      const [row] = await plantedCredentials(credentialId);
      expect(row.memberId).toBe(y.memberId);
    });
  });

  describe('on sign-up completion', () => {
    it("drops the previous member's step-up proof and registration challenge", async () => {
      const x = await seedSignedInMember(app);
      await completeStepUp(app, x);
      expect((await post(x.agent, '/webauthn/registration/options')).status).toBe(200);
      await completeStepUp(app, x);

      const email = await signUp(x.agent);
      expect(await signedInEmail(x.agent)).toBe(email);

      const credentialId = `cred-planted-${email}`;
      const verify = await verifyRegistration(x.agent, credentialId);
      expect(verify.status).toBe(400);
      expect(await plantedCredentials(credentialId)).toEqual([]);

      const options = await post(x.agent, '/webauthn/registration/options');
      expect(options.status).toBe(422);
      expect(codeOf(options)).toBe('step_up_required');

      const emailChange = await post(x.agent, '/members/profile', { email: uniqueEmail() });
      expect(emailChange.status).toBe(422);
    });
  });
});

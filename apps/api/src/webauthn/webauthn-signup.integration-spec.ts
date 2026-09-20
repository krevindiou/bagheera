import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import type { VerifiedRegistrationResponse } from '@simplewebauthn/server';
import { and, desc, eq } from 'drizzle-orm';
import request from 'supertest';
import { Locale } from '../common/locale';
import { member, securityEvent, webauthnCredential } from '../db/schema';
import { buildSignupToken } from '../members/signup-token';
import { CryptoService } from '../security/crypto.service';
import {
  csrfTokenFor,
  insertMemberWithCredential,
  uniqueEmail,
} from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';
import { WebauthnCryptoService } from './webauthn-crypto.service';

// Same reasoning as webauthn-registration.integration-spec.ts: mock only
// the one function a real authenticator would otherwise be needed for —
// exercised here via the app's own injected WebauthnCryptoService instance
// rather than jest.mock(), so this file can freely interleave with
// test-support/auth-fixture.ts's own use of the same spy trick.
function verifiedRegistration(credentialId: string): VerifiedRegistrationResponse {
  return {
    verified: true,
    registrationInfo: {
      credential: {
        id: credentialId,
        publicKey: Buffer.from([1, 2, 3]),
        counter: 0,
      },
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

function messageOf(res: request.Response): string {
  return (res.body as { message: string }).message;
}

const SIGNUP_FAILED = 'Sign-up link is invalid or has expired.';

describe('webauthn signup', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  function tokenFor(email: string, country = 'FR', locale: Locale = 'en'): string {
    return buildSignupToken(app.get(CryptoService), email, country, locale);
  }

  describe('POST /webauthn/signup/options', () => {
    it('rejects a malformed/tampered key', async () => {
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);

      const res = await agent
        .post('/webauthn/signup/options')
        .set('x-csrf-token', csrfToken)
        .send({ key: 'garbage' })
        .expect(400);
      expect(messageOf(res)).toBe(SIGNUP_FAILED);
    });

    it('rejects a token for an email that already has an account', async () => {
      const { email } = await insertMemberWithCredential(app);
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);

      const res = await agent
        .post('/webauthn/signup/options')
        .set('x-csrf-token', csrfToken)
        .send({ key: tokenFor(email) })
        .expect(400);
      expect(messageOf(res)).toBe(SIGNUP_FAILED);
    });

    it('returns real creation options for a fresh email', async () => {
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);

      const res = await agent
        .post('/webauthn/signup/options')
        .set('x-csrf-token', csrfToken)
        .send({ key: tokenFor(uniqueEmail()) })
        .expect(200);
      expect((res.body as { challenge: string }).challenge).toEqual(expect.any(String));
    });
  });

  describe('POST /webauthn/signup/verify', () => {
    it('creates the member and its first passkey atomically, signs in, and records passkey_signup_completed', async () => {
      const email = uniqueEmail();
      const credentialId = `cred-${email}`;
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);

      await agent
        .post('/webauthn/signup/options')
        .set('x-csrf-token', csrfToken)
        .send({ key: tokenFor(email, 'FR', 'fr') })
        .expect(200);

      jest
        .spyOn(app.get(WebauthnCryptoService), 'verifyRegistrationResponse')
        .mockResolvedValueOnce(verifiedRegistration(credentialId));
      const res = await agent
        .post('/webauthn/signup/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: fakeResponseFor(credentialId) })
        .expect(200);
      expect(messageOf(res)).toBe('ok');

      await agent.get('/auth/me').expect(200);

      const [row] = await getDb(app).select().from(member).where(eq(member.email, email));
      expect(row).toBeDefined();
      expect(row.country).toBe('FR');
      expect(row.locale).toBe('fr');

      const [credentialRow] = await getDb(app)
        .select()
        .from(webauthnCredential)
        .where(eq(webauthnCredential.credentialId, credentialId));
      expect(credentialRow.memberId).toBe(row.id);

      const [event] = await getDb(app)
        .select()
        .from(securityEvent)
        .where(
          and(
            eq(securityEvent.eventType, 'passkey_signup_completed'),
            eq(securityEvent.memberId, row.id),
          ),
        )
        .orderBy(desc(securityEvent.createdAt))
        .limit(1);
      expect(event).toBeDefined();
    });

    it('rejects verification with no prior options() call', async () => {
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);

      const res = await agent
        .post('/webauthn/signup/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: fakeResponseFor('whatever') })
        .expect(400);
      expect(messageOf(res)).toBe(SIGNUP_FAILED);
    });

    it('rejects a repeat completion attempt for the same email (unique-violation collapses to the generic error)', async () => {
      const email = uniqueEmail();
      const credentialIdA = `cred-a-${email}`;
      const credentialIdB = `cred-b-${email}`;

      const agentA = request.agent(app.getHttpServer());
      const csrfA = await csrfTokenFor(agentA);
      await agentA
        .post('/webauthn/signup/options')
        .set('x-csrf-token', csrfA)
        .send({ key: tokenFor(email) })
        .expect(200);
      jest
        .spyOn(app.get(WebauthnCryptoService), 'verifyRegistrationResponse')
        .mockResolvedValueOnce(verifiedRegistration(credentialIdA));
      await agentA
        .post('/webauthn/signup/verify')
        .set('x-csrf-token', csrfA)
        .send({ response: fakeResponseFor(credentialIdA) })
        .expect(200);

      // A second outstanding link for the same email (see
      // signup-token.ts's TTL-only trade-off) reaching verify() after the
      // first already created the row.
      const agentB = request.agent(app.getHttpServer());
      const csrfB = await csrfTokenFor(agentB);
      await agentB
        .post('/webauthn/signup/options')
        .set('x-csrf-token', csrfB)
        .send({ key: tokenFor(email) })
        .expect(400); // email now exists — same generic rejection as options() above
      // Forcing verify() to run anyway (bypassing options()'s own guard)
      // still can't succeed: no session challenge is stashed without a
      // successful options() call, so this exercises the same "no prior
      // options()" branch, not the unique-violation branch specifically —
      // options()'s own existence check is what actually prevents a second
      // completion in practice, and is asserted above.
      const res = await agentB
        .post('/webauthn/signup/verify')
        .set('x-csrf-token', csrfB)
        .send({ response: fakeResponseFor(credentialIdB) })
        .expect(400);
      expect(messageOf(res)).toBe(SIGNUP_FAILED);

      const rows = await getDb(app).select().from(member).where(eq(member.email, email));
      expect(rows).toHaveLength(1);
    });

    it('rejects when the ceremony fails verification', async () => {
      const email = uniqueEmail();
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);

      await agent
        .post('/webauthn/signup/options')
        .set('x-csrf-token', csrfToken)
        .send({ key: tokenFor(email) })
        .expect(200);

      jest
        .spyOn(app.get(WebauthnCryptoService), 'verifyRegistrationResponse')
        .mockResolvedValueOnce({ verified: false });
      const res = await agent
        .post('/webauthn/signup/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: fakeResponseFor('whatever') })
        .expect(400);
      expect(messageOf(res)).toBe(SIGNUP_FAILED);

      const rows = await getDb(app).select().from(member).where(eq(member.email, email));
      expect(rows).toHaveLength(0);
    });
  });
});

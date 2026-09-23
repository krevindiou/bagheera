import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, desc, eq } from 'drizzle-orm';
import type { VerifiedAuthenticationResponse } from '@simplewebauthn/server';
import request from 'supertest';
import { member, securityEvent, webauthnCredential } from '../db/schema';
import { csrfTokenFor, insertMemberWithCredential } from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';
import { WebauthnCryptoService } from './webauthn-crypto.service';

function verifiedResult(newCounter: number): VerifiedAuthenticationResponse {
  return {
    verified: true,
    authenticationInfo: { newCounter },
  } as unknown as VerifiedAuthenticationResponse;
}

function messageOf(res: request.Response): string {
  return (res.body as { message: string }).message;
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

describe('webauthn authentication', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  // Starts a sign-in ceremony on a fresh anonymous agent — usernameless, so
  // nothing about who is signing in is sent until verify().
  async function startCeremony() {
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);
    const options = await agent
      .post('/webauthn/authentication/options')
      .set('x-csrf-token', csrfToken)
      .expect(200);
    return { agent, csrfToken, options };
  }

  describe('POST /webauthn/authentication/options', () => {
    // M1: options used to take an email and answer with that member's
    // credential ids (or none) — an open "is this address registered?"
    // oracle. They now say nothing about any account.
    it('names no credentials and requires user verification', async () => {
      const { options } = await startCeremony();

      const body = options.body as {
        challenge: string;
        allowCredentials: unknown[];
        userVerification: string;
      };
      expect(typeof body.challenge).toBe('string');
      expect(body.allowCredentials).toEqual([]);
      expect(body.userVerification).toBe('required');
    });

    // M6: with no identifier left on this route, repeating it for one
    // victim's address can't lock that account out — only the (generous)
    // per-IP budget applies.
    it('has no per-account rate limit to exhaust', async () => {
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);

      const statuses: number[] = [];
      for (let i = 0; i < 10; i++) {
        const res = await agent
          .post('/webauthn/authentication/options')
          .set('x-csrf-token', csrfToken)
          .send({ email: 'victim@example.test' });
        statuses.push(res.status);
      }
      expect(statuses.every((status) => status === 200)).toBe(true);
    });
  });

  describe('POST /webauthn/authentication/verify', () => {
    it('signs in as the credential owner, bumps the counter, and records webauthn_sign_in_success', async () => {
      const { email, memberId, credentialId } = await insertMemberWithCredential(app);
      const { agent, csrfToken } = await startCeremony();

      jest
        .spyOn(app.get(WebauthnCryptoService), 'verifyAuthenticationResponse')
        .mockResolvedValueOnce(verifiedResult(7));
      const res = await agent
        .post('/webauthn/authentication/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: fakeResponseFor(credentialId) })
        .expect(200);
      expect(messageOf(res)).toBe('ok');

      const me = await agent.get('/auth/me').expect(200);
      expect((me.body as { email: string }).email).toBe(email);

      const [updatedCredential] = await getDb(app)
        .select()
        .from(webauthnCredential)
        .where(eq(webauthnCredential.credentialId, credentialId));
      expect(updatedCredential.counter).toBe(7);
      expect(updatedCredential.lastUsedAt).toBeInstanceOf(Date);

      const [updatedMember] = await getDb(app)
        .select({ loggedAt: member.loggedAt })
        .from(member)
        .where(eq(member.id, memberId));
      expect(updatedMember.loggedAt).toBeInstanceOf(Date);

      const [event] = await getDb(app)
        .select()
        .from(securityEvent)
        .where(
          and(
            eq(securityEvent.eventType, 'webauthn_sign_in_success'),
            eq(securityEvent.memberId, memberId),
          ),
        )
        .orderBy(desc(securityEvent.createdAt))
        .limit(1);
      expect(event).toBeDefined();
    });

    it('identifies the member from whichever credential answered', async () => {
      await insertMemberWithCredential(app);
      const memberB = await insertMemberWithCredential(app);
      const { agent, csrfToken } = await startCeremony();

      jest
        .spyOn(app.get(WebauthnCryptoService), 'verifyAuthenticationResponse')
        .mockResolvedValueOnce(verifiedResult(1));
      await agent
        .post('/webauthn/authentication/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: fakeResponseFor(memberB.credentialId) })
        .expect(200);

      const me = await agent.get('/auth/me').expect(200);
      expect((me.body as { email: string }).email).toBe(memberB.email);
    });

    it('rejects verification with no prior options() call', async () => {
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);

      const res = await agent
        .post('/webauthn/authentication/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: fakeResponseFor('whatever') })
        .expect(401);
      expect(messageOf(res)).toBe('Passkey sign-in failed.');
    });

    it('rejects a credential id no member has', async () => {
      const { agent, csrfToken } = await startCeremony();

      const res = await agent
        .post('/webauthn/authentication/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: fakeResponseFor('no-such-credential') })
        .expect(401);
      expect(messageOf(res)).toBe('Passkey sign-in failed.');
      await agent.get('/auth/me').expect(401);
    });

    it('rejects when the ceremony fails verification', async () => {
      const { credentialId } = await insertMemberWithCredential(app);
      const { agent, csrfToken } = await startCeremony();

      jest
        .spyOn(app.get(WebauthnCryptoService), 'verifyAuthenticationResponse')
        .mockResolvedValueOnce({ verified: false } as VerifiedAuthenticationResponse);
      const res = await agent
        .post('/webauthn/authentication/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: fakeResponseFor(credentialId) })
        .expect(401);
      expect(messageOf(res)).toBe('Passkey sign-in failed.');
    });

    it('consumes the challenge — a replayed verify() fails', async () => {
      const { credentialId } = await insertMemberWithCredential(app);
      const { agent, csrfToken } = await startCeremony();

      jest
        .spyOn(app.get(WebauthnCryptoService), 'verifyAuthenticationResponse')
        .mockResolvedValueOnce(verifiedResult(1));
      await agent
        .post('/webauthn/authentication/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: fakeResponseFor(credentialId) })
        .expect(200);

      // No second mock queued on purpose: the replay has to fail on the
      // missing challenge, before any signature check is reached.
      const replayToken = await csrfTokenFor(agent);
      await agent
        .post('/webauthn/authentication/verify')
        .set('x-csrf-token', replayToken)
        .send({ response: fakeResponseFor(credentialId) })
        .expect(401);
    });
  });
});

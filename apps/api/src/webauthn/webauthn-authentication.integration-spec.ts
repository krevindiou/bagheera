import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, desc, eq } from 'drizzle-orm';
import type { VerifiedAuthenticationResponse } from '@simplewebauthn/server';
import request from 'supertest';
import { member, securityEvent, webauthnCredential } from '../db/schema';
import {
  csrfTokenFor,
  insertMemberWithCredential,
  uniqueEmail,
} from '../test-support/auth-fixture';
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

  describe('POST /webauthn/authentication/options', () => {
    it('returns real, non-empty allowCredentials for a member with a passkey', async () => {
      const { email } = await insertMemberWithCredential(app);

      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);
      const res = await agent
        .post('/webauthn/authentication/options')
        .set('x-csrf-token', csrfToken)
        .send({ email })
        .expect(200);

      expect((res.body as { allowCredentials: unknown[] }).allowCredentials).toHaveLength(1);
    });

    it('returns the same shape with empty allowCredentials for an unknown email (anti-enumeration)', async () => {
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);
      const res = await agent
        .post('/webauthn/authentication/options')
        .set('x-csrf-token', csrfToken)
        .send({ email: uniqueEmail('nobody') })
        .expect(200);

      expect((res.body as { allowCredentials: unknown[] }).allowCredentials).toEqual([]);
    });
  });

  describe('POST /webauthn/authentication/verify', () => {
    it('signs in, bumps the counter, and records webauthn_sign_in_success', async () => {
      const { email, memberId, credentialId } = await insertMemberWithCredential(app);

      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);
      await agent
        .post('/webauthn/authentication/options')
        .set('x-csrf-token', csrfToken)
        .send({ email })
        .expect(200);

      jest
        .spyOn(app.get(WebauthnCryptoService), 'verifyAuthenticationResponse')
        .mockResolvedValueOnce(verifiedResult(7));
      const res = await agent
        .post('/webauthn/authentication/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: fakeResponseFor(credentialId) })
        .expect(200);
      expect(messageOf(res)).toBe('ok');

      await agent.get('/auth/me').expect(200);

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

    it('rejects when options() found no credential (anti-enumeration path)', async () => {
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);
      await agent
        .post('/webauthn/authentication/options')
        .set('x-csrf-token', csrfToken)
        .send({ email: uniqueEmail('nobody') })
        .expect(200);

      const res = await agent
        .post('/webauthn/authentication/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: fakeResponseFor('whatever') })
        .expect(401);
      expect(messageOf(res)).toBe('Passkey sign-in failed.');
    });

    it("rejects a response whose credential id belongs to someone else's stashed session", async () => {
      const memberA = await insertMemberWithCredential(app);
      const memberB = await insertMemberWithCredential(app);

      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);
      // Options are requested for member A...
      await agent
        .post('/webauthn/authentication/options')
        .set('x-csrf-token', csrfToken)
        .send({ email: memberA.email })
        .expect(200);

      // ...but the response presented is member B's credential id.
      const res = await agent
        .post('/webauthn/authentication/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: fakeResponseFor(memberB.credentialId) })
        .expect(401);
      expect(messageOf(res)).toBe('Passkey sign-in failed.');
    });

    it('rejects when the ceremony fails verification', async () => {
      const { email, credentialId } = await insertMemberWithCredential(app);

      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);
      await agent
        .post('/webauthn/authentication/options')
        .set('x-csrf-token', csrfToken)
        .send({ email })
        .expect(200);

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
  });
});

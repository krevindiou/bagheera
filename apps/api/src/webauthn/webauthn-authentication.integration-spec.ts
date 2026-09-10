import { INestApplication } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { VerifiedAuthenticationResponse } from '@simplewebauthn/server';
import request from 'supertest';
import { member, securityEvent, webauthnCredential } from '../db/schema';
import { HashService } from '../security/hash.service';
import {
  csrfTokenFor,
  insertActiveMember,
  uniqueEmail,
} from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';

// Same reasoning as webauthn-registration.integration-spec.ts: mock only
// the one function a real authenticator would otherwise be needed for.
jest.mock('@simplewebauthn/server', () => ({
  ...jest.requireActual<typeof import('@simplewebauthn/server')>(
    '@simplewebauthn/server',
  ),
  verifyAuthenticationResponse: jest.fn(),
}));

import { verifyAuthenticationResponse } from '@simplewebauthn/server';

const mockVerify = verifyAuthenticationResponse as jest.MockedFunction<
  typeof verifyAuthenticationResponse
>;

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

async function insertCredential(
  app: INestApplication,
  memberId: string,
  credentialId: string,
) {
  const [row] = await getDb(app)
    .insert(webauthnCredential)
    .values({
      memberId,
      credentialId,
      publicKey: Buffer.from([1, 2, 3]).toString('base64'),
      counter: 0,
    })
    .returning();
  return row;
}

/** A member with no password/session concerns, just a fixed active state and one passkey — for tests that never need to sign in with a password. */
async function insertMemberWithCredential(
  app: INestApplication,
  credentialId: string,
  overrides: { active?: boolean } = {},
) {
  const hash = await app.get(HashService).hash('unused-password-1');
  const [row] = await getDb(app)
    .insert(member)
    .values({
      email: uniqueEmail(),
      password: hash,
      country: 'FR',
      active: overrides.active ?? true,
    })
    .returning();
  await insertCredential(app, row.id, credentialId);
  return row;
}

describe('webauthn authentication', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockVerify.mockReset();
  });

  describe('POST /webauthn/authentication/options', () => {
    it('returns real, non-empty allowCredentials for a member with a passkey', async () => {
      const { email, memberId } = await insertActiveMember(app);
      await insertCredential(app, memberId, 'cred-opts-1');

      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);
      const res = await agent
        .post('/webauthn/authentication/options')
        .set('x-csrf-token', csrfToken)
        .send({ email })
        .expect(200);

      expect(
        (res.body as { allowCredentials: unknown[] }).allowCredentials,
      ).toHaveLength(1);
    });

    it('returns the same shape with empty allowCredentials for an unknown email (anti-enumeration)', async () => {
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);
      const res = await agent
        .post('/webauthn/authentication/options')
        .set('x-csrf-token', csrfToken)
        .send({ email: uniqueEmail('nobody') })
        .expect(200);

      expect(
        (res.body as { allowCredentials: unknown[] }).allowCredentials,
      ).toEqual([]);
    });
  });

  describe('POST /webauthn/authentication/verify', () => {
    it('signs in, bumps the counter, and records webauthn_sign_in_success', async () => {
      const row = await insertMemberWithCredential(app, 'cred-verify-1');

      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);
      await agent
        .post('/webauthn/authentication/options')
        .set('x-csrf-token', csrfToken)
        .send({ email: row.email })
        .expect(200);

      mockVerify.mockResolvedValueOnce(verifiedResult(7));
      const res = await agent
        .post('/webauthn/authentication/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: fakeResponseFor('cred-verify-1') })
        .expect(200);
      expect(messageOf(res)).toBe('ok');

      await agent.get('/auth/me').expect(200);

      const [updatedCredential] = await getDb(app)
        .select()
        .from(webauthnCredential)
        .where(eq(webauthnCredential.credentialId, 'cred-verify-1'));
      expect(updatedCredential.counter).toBe(7);
      expect(updatedCredential.lastUsedAt).toBeInstanceOf(Date);

      const [updatedMember] = await getDb(app)
        .select({ loggedAt: member.loggedAt })
        .from(member)
        .where(eq(member.id, row.id));
      expect(updatedMember.loggedAt).toBeInstanceOf(Date);

      const [event] = await getDb(app)
        .select()
        .from(securityEvent)
        .where(
          and(
            eq(securityEvent.eventType, 'webauthn_sign_in_success'),
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
        .post('/webauthn/authentication/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: fakeResponseFor('whatever') })
        .expect(401);
      expect(messageOf(res)).toBe('Passkey sign-in failed.');
      expect(mockVerify).not.toHaveBeenCalled();
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
      expect(mockVerify).not.toHaveBeenCalled();
    });

    it("rejects a response whose credential id belongs to someone else's stashed session", async () => {
      const memberA = await insertMemberWithCredential(app, 'cred-owner-a');
      await insertMemberWithCredential(app, 'cred-owner-b');

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
        .send({ response: fakeResponseFor('cred-owner-b') })
        .expect(401);
      expect(messageOf(res)).toBe('Passkey sign-in failed.');
      expect(mockVerify).not.toHaveBeenCalled();
    });

    it('rejects when the ceremony fails verification', async () => {
      const row = await insertMemberWithCredential(app, 'cred-fail-verify');

      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);
      await agent
        .post('/webauthn/authentication/options')
        .set('x-csrf-token', csrfToken)
        .send({ email: row.email })
        .expect(200);

      mockVerify.mockResolvedValueOnce({
        verified: false,
      } as VerifiedAuthenticationResponse);
      const res = await agent
        .post('/webauthn/authentication/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: fakeResponseFor('cred-fail-verify') })
        .expect(401);
      expect(messageOf(res)).toBe('Passkey sign-in failed.');
    });

    it('rejects a passkey sign-in for an inactive member', async () => {
      const row = await insertMemberWithCredential(app, 'cred-inactive', {
        active: false,
      });

      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);
      await agent
        .post('/webauthn/authentication/options')
        .set('x-csrf-token', csrfToken)
        .send({ email: row.email })
        .expect(200);

      mockVerify.mockResolvedValueOnce(verifiedResult(1));
      const res = await agent
        .post('/webauthn/authentication/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: fakeResponseFor('cred-inactive') })
        .expect(401);
      expect(messageOf(res)).toBe('Passkey sign-in failed.');
    });
  });
});

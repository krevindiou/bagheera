import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, desc, eq } from 'drizzle-orm';
import type { VerifiedRegistrationResponse } from '@simplewebauthn/server';
import request from 'supertest';
import { securityEvent, webauthnCredential } from '../db/schema';
import { csrfTokenFor, seedSignedInMember } from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';

// Real ceremony verification needs a physical authenticator, which nothing
// in this suite has — mock exactly the one function that would otherwise
// need one. Everything else (routing, DTO validation, session-stashed
// challenge, credential persistence/ownership, email queueing, audit)
// stays real. generateRegistrationOptions is *not* mocked — it's pure,
// deterministic, and this suite's only way to get a real challenge into
// the session for verify() to consume.
jest.mock('@simplewebauthn/server', () => ({
  ...jest.requireActual<typeof import('@simplewebauthn/server')>('@simplewebauthn/server'),
  verifyRegistrationResponse: jest.fn(),
}));

import { verifyRegistrationResponse } from '@simplewebauthn/server';

const mockVerify = verifyRegistrationResponse as jest.MockedFunction<
  typeof verifyRegistrationResponse
>;

function verifiedResult(credentialId: string): VerifiedRegistrationResponse {
  return {
    verified: true,
    registrationInfo: {
      credential: {
        id: credentialId,
        publicKey: new Uint8Array([1, 2, 3, 4]),
        counter: 0,
        transports: ['internal'],
      },
    },
  } as unknown as VerifiedRegistrationResponse;
}

const FAKE_RESPONSE = {
  id: 'client-id',
  rawId: 'client-id',
  response: {},
  clientExtensionResults: {},
  type: 'public-key',
};

describe('webauthn registration', () => {
  let app: INestApplication<Server>;
  let fakeEmailQueue: { enqueue: jest.Mock };

  beforeAll(async () => {
    ({ app, fakeEmailQueue } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockVerify.mockReset();
    fakeEmailQueue.enqueue.mockClear();
  });

  describe('POST /webauthn/registration/options', () => {
    it('returns real challenge options for a signed-in member', async () => {
      const { agent, getCsrfToken } = await seedSignedInMember(app);
      const csrfToken = await getCsrfToken();

      const res = await agent
        .post('/webauthn/registration/options')
        .set('x-csrf-token', csrfToken)
        .expect(200);

      expect(typeof (res.body as { challenge: string }).challenge).toBe('string');
      expect((res.body as { excludeCredentials: unknown[] }).excludeCredentials).toEqual([]);
    });

    it('requires authentication', async () => {
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);

      await agent.post('/webauthn/registration/options').set('x-csrf-token', csrfToken).expect(401);
    });
  });

  describe('POST /webauthn/registration/verify', () => {
    it('persists a credential, queues an alert email, and records the audit event', async () => {
      const { agent, getCsrfToken, memberId, email } = await seedSignedInMember(app);
      const csrfToken = await getCsrfToken();
      await agent.post('/webauthn/registration/options').set('x-csrf-token', csrfToken).expect(200);

      mockVerify.mockResolvedValueOnce(verifiedResult('cred-1'));
      await agent
        .post('/webauthn/registration/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: FAKE_RESPONSE, deviceName: 'Test device' })
        .expect(200);

      const [row] = await getDb(app)
        .select()
        .from(webauthnCredential)
        .where(eq(webauthnCredential.credentialId, 'cred-1'));
      expect(row.memberId).toBe(memberId);
      expect(row.deviceName).toBe('Test device');

      expect(fakeEmailQueue.enqueue).toHaveBeenCalledWith(expect.objectContaining({ to: email }));

      const [event] = await getDb(app)
        .select()
        .from(securityEvent)
        .where(
          and(
            eq(securityEvent.eventType, 'webauthn_credential_registered'),
            eq(securityEvent.memberId, memberId),
          ),
        )
        .orderBy(desc(securityEvent.createdAt))
        .limit(1);
      expect(event).toBeDefined();
    });

    it('rejects verification without a prior options() call', async () => {
      const { agent, getCsrfToken } = await seedSignedInMember(app);
      const csrfToken = await getCsrfToken();

      mockVerify.mockResolvedValueOnce(verifiedResult('cred-no-challenge'));
      const res = await agent
        .post('/webauthn/registration/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: FAKE_RESPONSE })
        .expect(400);
      expect((res.body as { message: string }).message).toBe('Passkey registration failed.');
    });

    it('rejects when the ceremony fails verification', async () => {
      const { agent, getCsrfToken } = await seedSignedInMember(app);
      const csrfToken = await getCsrfToken();
      await agent.post('/webauthn/registration/options').set('x-csrf-token', csrfToken).expect(200);

      mockVerify.mockResolvedValueOnce({
        verified: false,
      });
      const res = await agent
        .post('/webauthn/registration/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: FAKE_RESPONSE })
        .expect(400);
      expect((res.body as { message: string }).message).toBe('Passkey registration failed.');
    });

    it('rejects when verifyRegistrationResponse throws', async () => {
      const { agent, getCsrfToken } = await seedSignedInMember(app);
      const csrfToken = await getCsrfToken();
      await agent.post('/webauthn/registration/options').set('x-csrf-token', csrfToken).expect(200);

      mockVerify.mockRejectedValueOnce(new Error('bad attestation'));
      await agent
        .post('/webauthn/registration/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: FAKE_RESPONSE })
        .expect(400);
    });

    it('rejects registering the exact same credential id twice', async () => {
      const { agent, getCsrfToken } = await seedSignedInMember(app);
      const csrfToken1 = await getCsrfToken();
      await agent
        .post('/webauthn/registration/options')
        .set('x-csrf-token', csrfToken1)
        .expect(200);
      mockVerify.mockResolvedValueOnce(verifiedResult('cred-dup'));
      await agent
        .post('/webauthn/registration/verify')
        .set('x-csrf-token', csrfToken1)
        .send({ response: FAKE_RESPONSE })
        .expect(200);

      const csrfToken2 = await getCsrfToken();
      await agent
        .post('/webauthn/registration/options')
        .set('x-csrf-token', csrfToken2)
        .expect(200);
      mockVerify.mockResolvedValueOnce(verifiedResult('cred-dup'));
      await agent
        .post('/webauthn/registration/verify')
        .set('x-csrf-token', csrfToken2)
        .send({ response: FAKE_RESPONSE })
        .expect(400);
    });
  });
});

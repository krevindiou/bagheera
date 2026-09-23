import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, desc, eq } from 'drizzle-orm';
import type { VerifiedRegistrationResponse } from '@simplewebauthn/server';
import request from 'supertest';
import { securityEvent, webauthnCredential } from '../db/schema';
import {
  completeStepUp,
  csrfTokenFor,
  seedSignedInMember,
  SignedInFixture,
} from '../test-support/auth-fixture';
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

const STEP_UP_ERROR = 'Step-up verification is required or has expired.';

describe('webauthn registration', () => {
  let app: INestApplication<Server>;
  let fakeEmailQueue: { enqueue: jest.Mock };

  // Adding a passkey needs a fresh step-up proof, consumed by options() —
  // the same "confirm with a passkey you already hold" the web page runs
  // right before starting the ceremony.
  async function steppedUpOptions(fixture: SignedInFixture) {
    await completeStepUp(app, fixture);
    const res = await fixture.mutate('post', '/webauthn/registration/options');
    expect(res.status).toBe(200);
    return res;
  }

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
    it('returns real challenge options, excluding the credential the member already signed in with', async () => {
      const fixture = await seedSignedInMember(app);

      const res = await steppedUpOptions(fixture);

      expect(typeof (res.body as { challenge: string }).challenge).toBe('string');
      expect((res.body as { excludeCredentials: { id: string }[] }).excludeCredentials).toEqual([
        expect.objectContaining({ id: fixture.credentialId }),
      ]);
    });

    // M3: a signed-in session alone (a stolen cookie, an unattended laptop)
    // must not be able to plant a passkey of its own.
    it('rejects starting the ceremony without a fresh step-up', async () => {
      const { mutate } = await seedSignedInMember(app);

      const res = await mutate('post', '/webauthn/registration/options');
      expect(res.status).toBe(422);
      expect((res.body as { message: string }).message).toBe(STEP_UP_ERROR);
    });

    it('consumes the step-up — a second ceremony needs a second one', async () => {
      const fixture = await seedSignedInMember(app);
      await steppedUpOptions(fixture);

      const res = await fixture.mutate('post', '/webauthn/registration/options');
      expect(res.status).toBe(422);
    });

    it('requires authentication', async () => {
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);

      await agent.post('/webauthn/registration/options').set('x-csrf-token', csrfToken).expect(401);
    });
  });

  describe('POST /webauthn/registration/verify', () => {
    it('persists a credential, queues an alert email, and records the audit event', async () => {
      const fixture = await seedSignedInMember(app);
      await steppedUpOptions(fixture);

      mockVerify.mockResolvedValueOnce(verifiedResult('cred-1'));
      const res = await fixture.mutate('post', '/webauthn/registration/verify', {
        response: FAKE_RESPONSE,
        deviceName: 'Test device',
      });
      expect(res.status).toBe(200);

      const [row] = await getDb(app)
        .select()
        .from(webauthnCredential)
        .where(eq(webauthnCredential.credentialId, 'cred-1'));
      expect(row.memberId).toBe(fixture.memberId);
      expect(row.deviceName).toBe('Test device');

      expect(fakeEmailQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ to: fixture.email }),
      );

      const [event] = await getDb(app)
        .select()
        .from(securityEvent)
        .where(
          and(
            eq(securityEvent.eventType, 'webauthn_credential_registered'),
            eq(securityEvent.memberId, fixture.memberId),
          ),
        )
        .orderBy(desc(securityEvent.createdAt))
        .limit(1);
      expect(event).toBeDefined();
    });

    it('rejects verification without a prior options() call', async () => {
      const { mutate } = await seedSignedInMember(app);

      mockVerify.mockResolvedValueOnce(verifiedResult('cred-no-challenge'));
      const res = await mutate('post', '/webauthn/registration/verify', {
        response: FAKE_RESPONSE,
      });
      expect(res.status).toBe(400);
      expect((res.body as { message: string }).message).toBe('Passkey registration failed.');
    });

    // The sign-in options endpoint is public (it works for a signed-in
    // caller too) and stashes a challenge of its own. If registration
    // verify() accepted that one, a hijacked session could skip the gated
    // options() — and the step-up with it — entirely.
    it("doesn't accept a sign-in challenge in place of a registration one", async () => {
      const fixture = await seedSignedInMember(app);
      const signInOptions = await fixture.mutate('post', '/webauthn/authentication/options', {
        email: fixture.email,
      });
      expect(signInOptions.status).toBe(200);

      mockVerify.mockResolvedValueOnce(verifiedResult('cred-planted'));
      const res = await fixture.mutate('post', '/webauthn/registration/verify', {
        response: FAKE_RESPONSE,
      });
      expect(res.status).toBe(400);
      const planted = await getDb(app)
        .select()
        .from(webauthnCredential)
        .where(eq(webauthnCredential.credentialId, 'cred-planted'));
      expect(planted).toEqual([]);
    });

    it('rejects when the ceremony fails verification', async () => {
      const fixture = await seedSignedInMember(app);
      await steppedUpOptions(fixture);

      mockVerify.mockResolvedValueOnce({
        verified: false,
      });
      const res = await fixture.mutate('post', '/webauthn/registration/verify', {
        response: FAKE_RESPONSE,
      });
      expect(res.status).toBe(400);
      expect((res.body as { message: string }).message).toBe('Passkey registration failed.');
    });

    it('rejects when verifyRegistrationResponse throws', async () => {
      const fixture = await seedSignedInMember(app);
      await steppedUpOptions(fixture);

      mockVerify.mockRejectedValueOnce(new Error('bad attestation'));
      const res = await fixture.mutate('post', '/webauthn/registration/verify', {
        response: FAKE_RESPONSE,
      });
      expect(res.status).toBe(400);
    });

    it('rejects registering the exact same credential id twice', async () => {
      const fixture = await seedSignedInMember(app);
      await steppedUpOptions(fixture);
      mockVerify.mockResolvedValueOnce(verifiedResult('cred-dup'));
      const first = await fixture.mutate('post', '/webauthn/registration/verify', {
        response: FAKE_RESPONSE,
      });
      expect(first.status).toBe(200);

      await steppedUpOptions(fixture);
      mockVerify.mockResolvedValueOnce(verifiedResult('cred-dup'));
      const second = await fixture.mutate('post', '/webauthn/registration/verify', {
        response: FAKE_RESPONSE,
      });
      expect(second.status).toBe(400);
    });
  });
});

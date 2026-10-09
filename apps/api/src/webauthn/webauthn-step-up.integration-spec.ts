import { INestApplication } from '@nestjs/common';
import { vi } from 'vitest';
import type { Server } from 'http';
import type { VerifiedAuthenticationResponse } from '@simplewebauthn/server';
import { and, desc, eq } from 'drizzle-orm';
import request from 'supertest';
import { securityEvent } from '../db/schema';
import {
  csrfTokenFor,
  insertMemberWithCredential,
  seedSignedInMember,
} from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';
import { withClockAhead } from '../test-support/with-clock-ahead';
import { CHALLENGE_TTL_MS } from '../session/challenge';
import { WebauthnCryptoService } from './webauthn-crypto.service';

function verifiedResult(newCounter: number): VerifiedAuthenticationResponse {
  return {
    verified: true,
    authenticationInfo: { newCounter },
  } as unknown as VerifiedAuthenticationResponse;
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

const STEP_UP_FAILED = 'Step-up verification failed.';

describe('webauthn step-up', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /webauthn/step-up/options', () => {
    it('requires authentication', async () => {
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);

      await agent.post('/webauthn/step-up/options').set('x-csrf-token', csrfToken).expect(401);
    });

    it('returns real, non-empty allowCredentials scoped to the caller', async () => {
      const fixture = await seedSignedInMember(app);
      const csrfToken = await fixture.getCsrfToken();

      const res = await fixture.agent
        .post('/webauthn/step-up/options')
        .set('x-csrf-token', csrfToken)
        .expect(200);
      expect((res.body as { allowCredentials: unknown[] }).allowCredentials).toHaveLength(1);
    });
  });

  describe('POST /webauthn/step-up/verify', () => {
    it('verifies, bumps the counter, sets stepUpVerifiedAt, and records step_up_verified', async () => {
      const fixture = await seedSignedInMember(app);
      const csrfToken = await fixture.getCsrfToken();
      await fixture.agent
        .post('/webauthn/step-up/options')
        .set('x-csrf-token', csrfToken)
        .expect(200);

      vi.spyOn(
        app.get(WebauthnCryptoService),
        'verifyAuthenticationResponse',
      ).mockResolvedValueOnce(verifiedResult(9));
      const res = await fixture.agent
        .post('/webauthn/step-up/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: fakeResponseFor(fixture.credentialId) })
        .expect(200);
      expect(messageOf(res)).toBe('ok');

      const [event] = await getDb(app)
        .select()
        .from(securityEvent)
        .where(
          and(
            eq(securityEvent.eventType, 'step_up_verified'),
            eq(securityEvent.memberId, fixture.memberId),
          ),
        )
        .orderBy(desc(securityEvent.createdAt))
        .limit(1);
      expect(event).toBeDefined();
    });

    it('rejects verification with no prior options() call', async () => {
      const fixture = await seedSignedInMember(app);
      const csrfToken = await fixture.getCsrfToken();

      const res = await fixture.agent
        .post('/webauthn/step-up/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: fakeResponseFor(fixture.credentialId) })
        .expect(422);
      expect(messageOf(res)).toBe(STEP_UP_FAILED);
    });

    it("rejects a response whose credential id belongs to someone else's passkey", async () => {
      const other = await insertMemberWithCredential(app);
      const fixture = await seedSignedInMember(app);
      const csrfToken = await fixture.getCsrfToken();
      await fixture.agent
        .post('/webauthn/step-up/options')
        .set('x-csrf-token', csrfToken)
        .expect(200);

      const res = await fixture.agent
        .post('/webauthn/step-up/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: fakeResponseFor(other.credentialId) })
        .expect(422);
      expect(messageOf(res)).toBe(STEP_UP_FAILED);
    });

    it('rejects a challenge answered after it expired', async () => {
      const fixture = await seedSignedInMember(app);
      const csrfToken = await fixture.getCsrfToken();
      await fixture.agent
        .post('/webauthn/step-up/options')
        .set('x-csrf-token', csrfToken)
        .expect(200);

      const verifySpy = vi.spyOn(app.get(WebauthnCryptoService), 'verifyAuthenticationResponse');
      verifySpy.mockClear();
      const res = await withClockAhead(CHALLENGE_TTL_MS + 1000, () =>
        fixture.agent
          .post('/webauthn/step-up/verify')
          .set('x-csrf-token', csrfToken)
          .send({ response: fakeResponseFor(fixture.credentialId) }),
      );
      expect(res.status).toBe(422);
      // Refused on the stale challenge alone, before any signature check.
      expect(verifySpy).not.toHaveBeenCalled();
      expect(messageOf(res)).toBe(STEP_UP_FAILED);
    });

    // 422, not 401: the web client signs the member out on any 401, and
    // the session is still valid.
    it('rejects when the ceremony fails verification, leaving the member signed in', async () => {
      const fixture = await seedSignedInMember(app);
      const csrfToken = await fixture.getCsrfToken();
      await fixture.agent
        .post('/webauthn/step-up/options')
        .set('x-csrf-token', csrfToken)
        .expect(200);

      vi.spyOn(
        app.get(WebauthnCryptoService),
        'verifyAuthenticationResponse',
      ).mockResolvedValueOnce({ verified: false } as VerifiedAuthenticationResponse);
      const res = await fixture.agent
        .post('/webauthn/step-up/verify')
        .set('x-csrf-token', csrfToken)
        .send({ response: fakeResponseFor(fixture.credentialId) })
        .expect(422);
      expect(messageOf(res)).toBe(STEP_UP_FAILED);
      await fixture.agent.get('/auth/me').expect(200);
    });
  });
});

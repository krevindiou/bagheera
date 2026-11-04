import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { VerifiedRegistrationResponse } from '@simplewebauthn/server';
import request from 'supertest';
import { member, securityEvent, webauthnCredential } from '../db/schema';
import { buildEmailChangeToken } from '../members/email-change-token';
import { AuditService } from '../security/audit.service';
import { CryptoService } from '../security/crypto.service';
import { SessionRegistryService } from '../session/session-registry.service';
import {
  completeStepUp,
  csrfTokenFor,
  seedSignedInMember,
  signInWithPasskey,
  SignedInFixture,
  uniqueEmail,
} from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';
import { WebauthnCryptoService } from './webauthn-crypto.service';
import { vi } from 'vitest';

// A v4 id would 400 at ParseUuidV7Pipe before the existence check.
function nonexistentV7Id(): string {
  const v4 = randomUUID();
  return `${v4.slice(0, 14)}7${v4.slice(15)}`;
}

async function insertCredential(
  app: INestApplication<Server>,
  memberId: string,
  deviceName: string,
) {
  const [row] = await getDb(app)
    .insert(webauthnCredential)
    .values({
      memberId,
      credentialId: `cred-${randomUUID()}`,
      publicKey: Buffer.from([1, 2, 3]).toString('base64'),
      deviceName,
    })
    .returning();
  return row;
}

// Resolves once some database connection is waiting on a row lock.
async function waitForLockWaiter(db: ReturnType<typeof getDb>): Promise<void> {
  await vi.waitFor(
    async () => {
      const { rows } = await db.execute<{ waiting: number }>(
        sql`select count(*)::int as waiting from pg_stat_activity where wait_event_type = 'Lock'`,
      );
      if (rows[0].waiting === 0) throw new Error('no connection waiting on a lock yet');
    },
    { timeout: 5000, interval: 20 },
  );
}

const FAKE_REGISTRATION_RESPONSE = {
  id: 'client-id',
  rawId: 'client-id',
  response: {},
  clientExtensionResults: {},
  type: 'public-key',
};

// Another session of the fixture's member, e.g. whoever holds one of its passkeys.
async function signInElsewhere(
  app: INestApplication<Server>,
  fixture: SignedInFixture,
): Promise<Pick<SignedInFixture, 'agent' | 'credentialId' | 'getCsrfToken' | 'mutate'>> {
  const agent = request.agent(app.getHttpServer());
  await signInWithPasskey(app, agent, fixture.credentialId);
  const getCsrfToken = () => csrfTokenFor(agent);
  return {
    agent,
    credentialId: fixture.credentialId,
    getCsrfToken,
    mutate: async (method, url, body) => {
      const token = await getCsrfToken();
      const req = agent[method](url).set('x-csrf-token', token);
      return body === undefined ? req : req.send(body);
    },
  };
}

// Stubs the attestation check once, as the authenticator would pass it.
function stubRegistration(app: INestApplication<Server>, credentialId: string): void {
  vi.spyOn(app.get(WebauthnCryptoService), 'verifyRegistrationResponse').mockResolvedValueOnce({
    verified: true,
    registrationInfo: {
      credential: {
        id: credentialId,
        publicKey: new Uint8Array([1, 2, 3, 4]),
        counter: 0,
        transports: ['internal'],
      },
    },
  } as unknown as VerifiedRegistrationResponse);
}

describe('webauthn credentials', () => {
  let app: INestApplication<Server>;
  let fakeEmailQueue: { enqueue: ReturnType<typeof vi.fn> };

  beforeAll(async () => {
    ({ app, fakeEmailQueue } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /webauthn/credentials', () => {
    it("lists only the caller's own credentials, without exposing the public key or counter", async () => {
      // A second passkey besides the fixture's own.
      const { agent, memberId } = await seedSignedInMember(app);
      await insertCredential(app, memberId, 'My laptop');
      const { memberId: otherMemberId } = await seedSignedInMember(app);
      await insertCredential(app, otherMemberId, "Someone else's phone");

      const res = await agent.get('/webauthn/credentials').expect(200);
      const body = res.body as { deviceName: string | null; publicKey?: unknown }[];
      expect(body).toHaveLength(2);
      expect(body.map((row) => row.deviceName)).toEqual(expect.arrayContaining(['My laptop']));
      expect(body.every((row) => !('publicKey' in row))).toBe(true);
      expect(body.every((row) => !('counter' in row))).toBe(true);
      expect(body.every((row) => !('credentialId' in row))).toBe(true);
    });

    it('requires authentication', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent.get('/webauthn/credentials').expect(401);
    });
  });

  describe('DELETE /webauthn/credentials/:id', () => {
    beforeEach(() => {
      fakeEmailQueue.enqueue.mockClear();
    });

    it('removes the credential, emails the member, and records webauthn_credential_removed', async () => {
      const fixture = await seedSignedInMember(app);
      const credential = await insertCredential(app, fixture.memberId, 'To delete');

      await completeStepUp(app, fixture);
      const res = await fixture.mutate('delete', `/webauthn/credentials/${credential.id}`);
      expect(res.status).toBe(200);
      expect((res.body as { message: string }).message).toBe('ok');

      const rows = await getDb(app)
        .select()
        .from(webauthnCredential)
        .where(eq(webauthnCredential.id, credential.id));
      expect(rows).toHaveLength(0);

      expect(fakeEmailQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ to: fixture.email, subject: 'Bagheera passkey removed' }),
      );

      const [event] = await getDb(app)
        .select()
        .from(securityEvent)
        .where(
          and(
            eq(securityEvent.eventType, 'webauthn_credential_removed'),
            eq(securityEvent.memberId, fixture.memberId),
          ),
        )
        .orderBy(desc(securityEvent.createdAt))
        .limit(1);
      expect(event).toBeDefined();
    });

    it('still removes the credential and records it when the alert cannot be queued', async () => {
      const fixture = await seedSignedInMember(app);
      const credential = await insertCredential(app, fixture.memberId, 'To delete');
      fakeEmailQueue.enqueue.mockRejectedValueOnce(new Error('Connection is closed.'));

      await completeStepUp(app, fixture);
      const res = await fixture.mutate('delete', `/webauthn/credentials/${credential.id}`);
      expect(res.status).toBe(200);

      const [event] = await getDb(app)
        .select()
        .from(securityEvent)
        .where(
          and(
            eq(securityEvent.eventType, 'webauthn_credential_removed'),
            eq(securityEvent.memberId, fixture.memberId),
          ),
        )
        .limit(1);
      expect(event).toBeDefined();
    });

    it("signs out the member's other sessions but keeps the current one", async () => {
      const fixture = await seedSignedInMember(app);
      const credential = await insertCredential(app, fixture.memberId, 'Compromised');
      const otherDevice = request.agent(app.getHttpServer());
      await signInWithPasskey(app, otherDevice, fixture.credentialId);
      await otherDevice.get('/auth/me').expect(200);

      await completeStepUp(app, fixture);
      const res = await fixture.mutate('delete', `/webauthn/credentials/${credential.id}`);
      expect(res.status).toBe(200);

      await fixture.agent.get('/auth/me').expect(200);
      await otherDevice.get('/auth/me').expect(401);
    });

    // The registry lives in Valkey; the member's session epoch does not.
    it('still signs out the other sessions and records the removal when Valkey cannot revoke them', async () => {
      const fixture = await seedSignedInMember(app);
      const credential = await insertCredential(app, fixture.memberId, 'Compromised');
      const otherDevice = request.agent(app.getHttpServer());
      await signInWithPasskey(app, otherDevice, fixture.credentialId);
      await completeStepUp(app, fixture);
      const revoke = vi
        .spyOn(app.get(SessionRegistryService), 'revokeOthers')
        .mockRejectedValueOnce(new Error('Connection is closed.'));

      try {
        const res = await fixture.mutate('delete', `/webauthn/credentials/${credential.id}`);
        expect(res.status).toBe(200);
        expect(revoke).toHaveBeenCalled();
      } finally {
        revoke.mockRestore();
      }

      const events = await getDb(app)
        .select()
        .from(securityEvent)
        .where(
          and(
            eq(securityEvent.eventType, 'webauthn_credential_removed'),
            eq(securityEvent.memberId, fixture.memberId),
          ),
        );
      expect(events).toHaveLength(1);
      await fixture.agent.get('/auth/me').expect(200);
      await otherDevice.get('/auth/me').expect(401);
    });

    it('answers without waiting for the alert to be queued', async () => {
      const fixture = await seedSignedInMember(app);
      const credential = await insertCredential(app, fixture.memberId, 'To delete');
      fakeEmailQueue.enqueue.mockReturnValueOnce(new Promise<void>(() => undefined));

      await completeStepUp(app, fixture);
      const res = await fixture.mutate('delete', `/webauthn/credentials/${credential.id}`);
      expect(res.status).toBe(200);
      expect(fakeEmailQueue.enqueue).toHaveBeenCalledTimes(1);
    });

    it('keeps the passkey when its removal cannot be recorded', async () => {
      const fixture = await seedSignedInMember(app);
      const credential = await insertCredential(app, fixture.memberId, 'Still here');
      const otherDevice = request.agent(app.getHttpServer());
      await signInWithPasskey(app, otherDevice, fixture.credentialId);
      await completeStepUp(app, fixture);
      const recordIn = vi
        .spyOn(app.get(AuditService), 'recordIn')
        .mockRejectedValueOnce(new Error('insert failed'));

      try {
        const res = await fixture.mutate('delete', `/webauthn/credentials/${credential.id}`);
        expect(res.status).toBe(500);
      } finally {
        recordIn.mockRestore();
      }

      const rows = await getDb(app)
        .select()
        .from(webauthnCredential)
        .where(eq(webauthnCredential.id, credential.id));
      expect(rows).toHaveLength(1);
      const [row] = await getDb(app)
        .select({ sessionEpoch: member.sessionEpoch })
        .from(member)
        .where(eq(member.id, fixture.memberId));
      expect(row.sessionEpoch).toBe(0);
      expect(fakeEmailQueue.enqueue).not.toHaveBeenCalled();
      await otherDevice.get('/auth/me').expect(200);
    });

    // A hijacked session alone must not delete the owner's passkey.
    it('rejects removal without a fresh step-up and leaves the credential in place', async () => {
      const { memberId, mutate } = await seedSignedInMember(app);
      const credential = await insertCredential(app, memberId, 'Still here');

      const res = await mutate('delete', `/webauthn/credentials/${credential.id}`);
      expect(res.status).toBe(422);
      expect((res.body as { message: string }).message).toBe(
        'Step-up verification is required or has expired.',
      );

      const rows = await getDb(app)
        .select()
        .from(webauthnCredential)
        .where(eq(webauthnCredential.id, credential.id));
      expect(rows).toHaveLength(1);
      expect(fakeEmailQueue.enqueue).not.toHaveBeenCalled();
    });

    it("404s on another member's credential and leaves it untouched", async () => {
      const { memberId: ownerId } = await seedSignedInMember(app);
      const credential = await insertCredential(app, ownerId, 'Not yours');
      const attacker = await seedSignedInMember(app);

      await completeStepUp(app, attacker);
      const res = await attacker.mutate('delete', `/webauthn/credentials/${credential.id}`);
      expect(res.status).toBe(404);

      const rows = await getDb(app)
        .select()
        .from(webauthnCredential)
        .where(eq(webauthnCredential.id, credential.id));
      expect(rows).toHaveLength(1);
    });

    it('404s on a credential id that does not exist', async () => {
      const fixture = await seedSignedInMember(app);

      await completeStepUp(app, fixture);
      const res = await fixture.mutate('delete', `/webauthn/credentials/${nonexistentV7Id()}`);
      expect(res.status).toBe(404);
    });

    it('blocks removing the last remaining passkey (no password fallback, no recovery)', async () => {
      const fixture = await seedSignedInMember(app);
      const [only] = await getDb(app)
        .select()
        .from(webauthnCredential)
        .where(eq(webauthnCredential.credentialId, fixture.credentialId));

      await completeStepUp(app, fixture);
      const res = await fixture.mutate('delete', `/webauthn/credentials/${only.id}`);
      expect(res.status).toBe(400);
      expect((res.body as { message: string }).message).toBe(
        'Cannot remove your last passkey — it would lock you out permanently.',
      );

      const rows = await getDb(app)
        .select()
        .from(webauthnCredential)
        .where(eq(webauthnCredential.id, only.id));
      expect(rows).toHaveLength(1);
    });

    it('withdraws a pending email change, so its link no longer confirms', async () => {
      const fixture = await seedSignedInMember(app);
      const credential = await insertCredential(app, fixture.memberId, 'Compromised');
      const newEmail = uniqueEmail('pending');
      await completeStepUp(app, fixture);
      expect((await fixture.mutate('post', '/members/profile', { email: newEmail })).status).toBe(
        200,
      );
      const [before] = await getDb(app)
        .select({ version: member.emailChangeTokenVersion })
        .from(member)
        .where(eq(member.id, fixture.memberId));
      const key = buildEmailChangeToken(
        app.get(CryptoService),
        fixture.memberId,
        newEmail,
        before.version,
      );

      await completeStepUp(app, fixture);
      const removal = await fixture.mutate('delete', `/webauthn/credentials/${credential.id}`);
      expect(removal.status).toBe(200);

      const confirmAgent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(confirmAgent);
      const res = await confirmAgent
        .post('/members/profile/confirm-email-change')
        .set('x-csrf-token', csrfToken)
        .send({ key });
      expect(res.status).toBe(400);
      expect((res.body as { code: string }).code).toBe('email_change_link_invalid');
      const [after] = await getDb(app).select().from(member).where(eq(member.id, fixture.memberId));
      expect(after.email).toBe(fixture.email);
      expect(after.pendingEmail).toBeNull();
    });

    it('lets the session that removed a passkey enroll another afterwards', async () => {
      const fixture = await seedSignedInMember(app);
      const credential = await insertCredential(app, fixture.memberId, 'Old device');
      await completeStepUp(app, fixture);
      expect(
        (await fixture.mutate('delete', `/webauthn/credentials/${credential.id}`)).status,
      ).toBe(200);

      await completeStepUp(app, fixture);
      expect((await fixture.mutate('post', '/webauthn/registration/options')).status).toBe(200);
      const credentialId = `cred-${randomUUID()}`;
      stubRegistration(app, credentialId);
      const res = await fixture.mutate('post', '/webauthn/registration/verify', {
        response: FAKE_REGISTRATION_RESPONSE,
      });
      expect(res.status).toBe(200);

      const rows = await getDb(app)
        .select()
        .from(webauthnCredential)
        .where(eq(webauthnCredential.credentialId, credentialId));
      expect(rows).toHaveLength(1);
    });

    // The transactions below play the removal: they hold the member row
    // locked, and end the other sessions while the request waits on it.
    async function heldAcrossRemoval(
      memberId: string,
      credentialId: string,
      send: () => Promise<request.Response>,
    ): Promise<request.Response> {
      const db = getDb(app);
      let pending!: Promise<request.Response>;
      await db.transaction(async (tx) => {
        await tx
          .select({ id: member.id })
          .from(member)
          .where(eq(member.id, memberId))
          .for('update');
        pending = send();
        await waitForLockWaiter(db);
        await tx.delete(webauthnCredential).where(eq(webauthnCredential.id, credentialId));
        await tx
          .update(member)
          .set({ sessionEpoch: sql`${member.sessionEpoch} + 1` })
          .where(eq(member.id, memberId));
      });
      return pending;
    }

    it('refuses a passkey enrollment still in flight when the removal ended its session', async () => {
      const fixture = await seedSignedInMember(app);
      const credential = await insertCredential(app, fixture.memberId, 'Compromised');
      const otherDevice = await signInElsewhere(app, fixture);
      await completeStepUp(app, otherDevice);
      expect((await otherDevice.mutate('post', '/webauthn/registration/options')).status).toBe(200);
      const csrfToken = await otherDevice.getCsrfToken();
      const plantedId = `cred-${randomUUID()}`;
      stubRegistration(app, plantedId);
      fakeEmailQueue.enqueue.mockClear();

      const res = await heldAcrossRemoval(fixture.memberId, credential.id, () =>
        otherDevice.agent
          .post('/webauthn/registration/verify')
          .set('x-csrf-token', csrfToken)
          .send({ response: FAKE_REGISTRATION_RESPONSE })
          .then((response) => response),
      );
      expect(res.status).toBe(401);

      const planted = await getDb(app)
        .select()
        .from(webauthnCredential)
        .where(eq(webauthnCredential.credentialId, plantedId));
      expect(planted).toEqual([]);
      expect(fakeEmailQueue.enqueue).not.toHaveBeenCalled();
    });

    it('refuses an email change request still in flight when the removal ended its session', async () => {
      const fixture = await seedSignedInMember(app);
      const credential = await insertCredential(app, fixture.memberId, 'Compromised');
      const otherDevice = await signInElsewhere(app, fixture);
      await completeStepUp(app, otherDevice);
      const csrfToken = await otherDevice.getCsrfToken();
      fakeEmailQueue.enqueue.mockClear();

      const res = await heldAcrossRemoval(fixture.memberId, credential.id, () =>
        otherDevice.agent
          .post('/members/profile')
          .set('x-csrf-token', csrfToken)
          .send({ email: uniqueEmail('planted') })
          .then((response) => response),
      );
      expect(res.status).toBe(401);

      const [row] = await getDb(app)
        .select({ pendingEmail: member.pendingEmail })
        .from(member)
        .where(eq(member.id, fixture.memberId));
      expect(row.pendingEmail).toBeNull();
      expect(fakeEmailQueue.enqueue).not.toHaveBeenCalled();
    });

    // Two removals at once, one per passkey, must not both pass the
    // last-passkey check. The transaction below plays the other removal: it
    // holds the member's passkeys locked, and deletes one while this request
    // waits.
    it('keeps the last passkey when a concurrent removal commits first', async () => {
      const fixture = await seedSignedInMember(app);
      const db = getDb(app);
      const [first] = await db
        .select()
        .from(webauthnCredential)
        .where(eq(webauthnCredential.credentialId, fixture.credentialId));
      const second = await insertCredential(app, fixture.memberId, 'Second device');
      await completeStepUp(app, fixture);

      let removal!: ReturnType<typeof fixture.mutate>;
      await db.transaction(async (tx) => {
        await tx
          .select({ id: webauthnCredential.id })
          .from(webauthnCredential)
          .where(eq(webauthnCredential.memberId, fixture.memberId))
          .for('update');
        removal = fixture.mutate('delete', `/webauthn/credentials/${second.id}`);
        await waitForLockWaiter(db);
        await tx.delete(webauthnCredential).where(eq(webauthnCredential.id, first.id));
      });

      const res = await removal;
      expect(res.status).toBe(400);
      const remaining = await db
        .select({ id: webauthnCredential.id })
        .from(webauthnCredential)
        .where(eq(webauthnCredential.memberId, fixture.memberId));
      expect(remaining).toEqual([{ id: second.id }]);
    });
  });
});

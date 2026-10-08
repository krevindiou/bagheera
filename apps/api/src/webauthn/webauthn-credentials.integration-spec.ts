import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, desc, eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { securityEvent, webauthnCredential } from '../db/schema';
import {
  completeStepUp,
  seedSignedInMember,
  signInWithPasskey,
} from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';
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

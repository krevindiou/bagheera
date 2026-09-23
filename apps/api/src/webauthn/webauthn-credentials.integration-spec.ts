import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, desc, eq } from 'drizzle-orm';
import request from 'supertest';
import { securityEvent, webauthnCredential } from '../db/schema';
import { completeStepUp, seedSignedInMember } from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';

// Every :id path param in this API goes through ParseUuidV7Pipe, which
// checks the version nibble — a plain (v4) randomUUID() would 400 before
// ever reaching the "does it exist" check this test wants. Force the
// version nibble to look like a real (but nonexistent) v7 id instead.
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

describe('webauthn credentials', () => {
  let app: INestApplication<Server>;
  let fakeEmailQueue: { enqueue: jest.Mock };

  beforeAll(async () => {
    ({ app, fakeEmailQueue } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /webauthn/credentials', () => {
    it("lists only the caller's own credentials, without exposing the public key or counter", async () => {
      // seedSignedInMember already gives the member one passkey (the one
      // it signs in with) — this adds a second, distinct one to prove
      // listing isn't accidentally capped at one.
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

    // M3: with only a session, a hijacker who planted a passkey could then
    // delete the owner's — a permanent lockout, since there's no recovery.
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
  });
});

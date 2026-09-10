import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import request from 'supertest';
import { securityEvent, webauthnCredential } from '../db/schema';
import { seedSignedInMember } from '../test-support/auth-fixture';
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
  app: INestApplication,
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
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /webauthn/credentials', () => {
    it("lists only the caller's own credentials, without exposing the public key or counter", async () => {
      const { agent, memberId } = await seedSignedInMember(app);
      await insertCredential(app, memberId, 'My laptop');
      const { memberId: otherMemberId } = await seedSignedInMember(app);
      await insertCredential(app, otherMemberId, "Someone else's phone");

      const res = await agent.get('/webauthn/credentials').expect(200);
      const body = res.body as { deviceName: string | null }[];
      expect(body).toHaveLength(1);
      expect(body[0].deviceName).toBe('My laptop');
      expect(body[0]).not.toHaveProperty('publicKey');
      expect(body[0]).not.toHaveProperty('counter');
      expect(body[0]).not.toHaveProperty('credentialId');
    });

    it('requires authentication', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent.get('/webauthn/credentials').expect(401);
    });
  });

  describe('DELETE /webauthn/credentials/:id', () => {
    it('removes the credential and records webauthn_credential_removed', async () => {
      const { agent, getCsrfToken, memberId } = await seedSignedInMember(app);
      const credential = await insertCredential(app, memberId, 'To delete');

      const csrfToken = await getCsrfToken();
      const res = await agent
        .delete(`/webauthn/credentials/${credential.id}`)
        .set('x-csrf-token', csrfToken)
        .expect(200);
      expect((res.body as { message: string }).message).toBe('ok');

      const rows = await getDb(app)
        .select()
        .from(webauthnCredential)
        .where(eq(webauthnCredential.id, credential.id));
      expect(rows).toHaveLength(0);

      const [event] = await getDb(app)
        .select()
        .from(securityEvent)
        .where(
          and(
            eq(securityEvent.eventType, 'webauthn_credential_removed'),
            eq(securityEvent.memberId, memberId),
          ),
        )
        .orderBy(desc(securityEvent.createdAt))
        .limit(1);
      expect(event).toBeDefined();
    });

    it("404s on another member's credential and leaves it untouched", async () => {
      const { memberId: ownerId } = await seedSignedInMember(app);
      const credential = await insertCredential(app, ownerId, 'Not yours');
      const { agent: attackerAgent, getCsrfToken } =
        await seedSignedInMember(app);

      const csrfToken = await getCsrfToken();
      await attackerAgent
        .delete(`/webauthn/credentials/${credential.id}`)
        .set('x-csrf-token', csrfToken)
        .expect(404);

      const rows = await getDb(app)
        .select()
        .from(webauthnCredential)
        .where(eq(webauthnCredential.id, credential.id));
      expect(rows).toHaveLength(1);
    });

    it('404s on a credential id that does not exist', async () => {
      const { agent, getCsrfToken } = await seedSignedInMember(app);
      const csrfToken = await getCsrfToken();

      await agent
        .delete(`/webauthn/credentials/${nonexistentV7Id()}`)
        .set('x-csrf-token', csrfToken)
        .expect(404);
    });
  });
});

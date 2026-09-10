import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { member } from '../db/schema';
import { CryptoService } from '../security/crypto.service';
import {
  csrfTokenFor,
  insertActiveMember,
  seedSignedInMember,
  uniqueEmail,
} from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';
import { buildEmailChangeToken } from './email-change-token';

function messageOf(res: request.Response): string {
  return (res.body as { message: string }).message;
}

const UPDATE_MESSAGE =
  "If this email isn't already registered to another account, check it for a link to confirm the change.";

describe('POST /members/profile', () => {
  let app: INestApplication;
  let fakeEmailQueue: { enqueue: jest.Mock };

  beforeAll(async () => {
    ({ app, fakeEmailQueue } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    fakeEmailQueue.enqueue.mockClear();
  });

  describe('POST /members/profile (start an email change)', () => {
    it('sets pendingEmail and queues a confirmation to the new address, leaving email unchanged', async () => {
      const { agent, getCsrfToken, password, memberId } =
        await seedSignedInMember(app);
      const newEmail = uniqueEmail('new-address');

      const csrfToken = await getCsrfToken();
      const res = await agent
        .post('/members/profile')
        .set('x-csrf-token', csrfToken)
        .send({ email: newEmail, currentPassword: password })
        .expect(200);
      expect(messageOf(res)).toBe(UPDATE_MESSAGE);

      const [row] = await getDb(app)
        .select()
        .from(member)
        .where(eq(member.id, memberId));
      expect(row.email).not.toBe(newEmail);
      expect(row.pendingEmail).toBe(newEmail);
      expect(fakeEmailQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ to: newEmail }),
      );
    });

    it('rejects a wrong current password', async () => {
      const { agent, getCsrfToken } = await seedSignedInMember(app);

      const csrfToken = await getCsrfToken();
      const res = await agent
        .post('/members/profile')
        .set('x-csrf-token', csrfToken)
        .send({ email: uniqueEmail(), currentPassword: 'wrong-password' })
        .expect(400);
      expect(messageOf(res)).toBe('Current password is invalid.');
    });

    it('requires authentication', async () => {
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);

      await agent
        .post('/members/profile')
        .set('x-csrf-token', csrfToken)
        .send({ email: uniqueEmail(), currentPassword: 'whatever12' })
        .expect(401);
    });

    it('no-ops when the "new" email is the same as the current one', async () => {
      const { agent, getCsrfToken, password, email, memberId } =
        await seedSignedInMember(app);

      const csrfToken = await getCsrfToken();
      await agent
        .post('/members/profile')
        .set('x-csrf-token', csrfToken)
        .send({ email, currentPassword: password })
        .expect(200);

      expect(fakeEmailQueue.enqueue).not.toHaveBeenCalled();
      const [row] = await getDb(app)
        .select({ pendingEmail: member.pendingEmail })
        .from(member)
        .where(eq(member.id, memberId));
      expect(row.pendingEmail).toBeNull();
    });

    it('returns the same generic message and changes nothing when the new email is already taken', async () => {
      const other = await insertActiveMember(app);
      const { agent, getCsrfToken, password, memberId } =
        await seedSignedInMember(app);

      const csrfToken = await getCsrfToken();
      const res = await agent
        .post('/members/profile')
        .set('x-csrf-token', csrfToken)
        .send({ email: other.email, currentPassword: password })
        .expect(200);
      expect(messageOf(res)).toBe(UPDATE_MESSAGE);
      expect(fakeEmailQueue.enqueue).not.toHaveBeenCalled();

      const [row] = await getDb(app)
        .select({ pendingEmail: member.pendingEmail })
        .from(member)
        .where(eq(member.id, memberId));
      expect(row.pendingEmail).toBeNull();
    });
  });

  describe('POST /members/profile/confirm-email-change', () => {
    it('completes a pending change and notifies the old address', async () => {
      const { agent, getCsrfToken, password, memberId } =
        await seedSignedInMember(app);
      const newEmail = uniqueEmail('confirmed');
      const startCsrfToken = await getCsrfToken();
      await agent
        .post('/members/profile')
        .set('x-csrf-token', startCsrfToken)
        .send({ email: newEmail, currentPassword: password })
        .expect(200);
      fakeEmailQueue.enqueue.mockClear();

      const [row] = await getDb(app)
        .select({ version: member.emailChangeTokenVersion })
        .from(member)
        .where(eq(member.id, memberId));
      const key = buildEmailChangeToken(
        app.get(CryptoService),
        memberId,
        newEmail,
        row.version,
      );

      const confirmAgent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(confirmAgent);
      await confirmAgent
        .post('/members/profile/confirm-email-change')
        .set('x-csrf-token', csrfToken)
        .send({ key })
        .expect(200);

      const [updated] = await getDb(app)
        .select()
        .from(member)
        .where(eq(member.id, memberId));
      expect(updated.email).toBe(newEmail);
      expect(updated.pendingEmail).toBeNull();

      // Replaying the same key fails — the version bumped again.
      const replayAgent = request.agent(app.getHttpServer());
      const replayCsrf = await csrfTokenFor(replayAgent);
      const replay = await replayAgent
        .post('/members/profile/confirm-email-change')
        .set('x-csrf-token', replayCsrf)
        .send({ key })
        .expect(400);
      expect(messageOf(replay)).toBe(
        'Email change error (link expired or already used?)',
      );
    });

    it('rejects a malformed key', async () => {
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);

      const res = await agent
        .post('/members/profile/confirm-email-change')
        .set('x-csrf-token', csrfToken)
        .send({ key: 'not-a-real-token' })
        .expect(400);
      expect(messageOf(res)).toBe(
        'Email change error (link expired or already used?)',
      );
    });
  });
});

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
import { buildResetToken } from './reset-token';

function messageOf(res: request.Response): string {
  return (res.body as { message: string }).message;
}

const REQUEST_MESSAGE =
  'If an account exists for this address, a password reset link has been sent.';

describe('POST /auth/password-recovery', () => {
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

  describe('POST /auth/password-recovery (request)', () => {
    it('queues a reset email for a real member and returns the generic message', async () => {
      const { email } = await insertActiveMember(app);
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);

      const res = await agent
        .post('/auth/password-recovery')
        .set('x-csrf-token', csrfToken)
        .send({ email })
        .expect(200);

      expect(messageOf(res)).toBe(REQUEST_MESSAGE);
      expect(fakeEmailQueue.enqueue).toHaveBeenCalledTimes(1);
      expect(fakeEmailQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ to: email }),
      );
    });

    it('returns the exact same message for an unknown email and queues nothing', async () => {
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);

      const res = await agent
        .post('/auth/password-recovery')
        .set('x-csrf-token', csrfToken)
        .send({ email: uniqueEmail('nobody') })
        .expect(200);

      expect(messageOf(res)).toBe(REQUEST_MESSAGE);
      expect(fakeEmailQueue.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/password-recovery/reset', () => {
    it('resets the password with a valid key and terminates every existing session', async () => {
      const {
        agent: signedInAgent,
        email,
        password,
      } = await seedSignedInMember(app);
      await signedInAgent.get('/auth/me').expect(200);

      const [row] = await getDb(app)
        .select({ version: member.passwordResetTokenVersion })
        .from(member)
        .where(eq(member.email, email));
      const key = buildResetToken(app.get(CryptoService), email, row.version);
      const newPassword = 'freshly-reset-password-1';

      const resetAgent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(resetAgent);
      await resetAgent
        .post('/auth/password-recovery/reset')
        .set('x-csrf-token', csrfToken)
        .send({
          key,
          password: newPassword,
          passwordConfirmation: newPassword,
        })
        .expect(200);

      // The pre-existing signed-in session is gone.
      await signedInAgent.get('/auth/me').expect(401);

      // Old password no longer works; the new one does.
      const checkAgent = request.agent(app.getHttpServer());
      const checkCsrf = await csrfTokenFor(checkAgent);
      await checkAgent
        .post('/auth/sign-in')
        .set('x-csrf-token', checkCsrf)
        .send({ email, password })
        .expect(401);

      const checkAgent2 = request.agent(app.getHttpServer());
      const checkCsrf2 = await csrfTokenFor(checkAgent2);
      await checkAgent2
        .post('/auth/sign-in')
        .set('x-csrf-token', checkCsrf2)
        .send({ email, password: newPassword })
        .expect(200);

      // Replaying the same key a second time no longer works — the
      // version bump invalidated it.
      const replayAgent = request.agent(app.getHttpServer());
      const replayCsrf = await csrfTokenFor(replayAgent);
      const replay = await replayAgent
        .post('/auth/password-recovery/reset')
        .set('x-csrf-token', replayCsrf)
        .send({
          key,
          password: 'another-password-1',
          passwordConfirmation: 'another-password-1',
        })
        .expect(400);
      expect(messageOf(replay)).toBe('Password reset error');
    });

    it('rejects a malformed key with the generic error', async () => {
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);

      const res = await agent
        .post('/auth/password-recovery/reset')
        .set('x-csrf-token', csrfToken)
        .send({
          key: 'not-a-real-token',
          password: 'whatever-new-1',
          passwordConfirmation: 'whatever-new-1',
        })
        .expect(400);
      expect(messageOf(res)).toBe('Password reset error');
    });

    it('rejects mismatched password confirmation', async () => {
      const { email } = await insertActiveMember(app);
      const [row] = await getDb(app)
        .select({ version: member.passwordResetTokenVersion })
        .from(member)
        .where(eq(member.email, email));
      const key = buildResetToken(app.get(CryptoService), email, row.version);

      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);
      const res = await agent
        .post('/auth/password-recovery/reset')
        .set('x-csrf-token', csrfToken)
        .send({
          key,
          password: 'one-password-1',
          passwordConfirmation: 'a-different-password-1',
        })
        .expect(400);
      expect(messageOf(res)).toBe("Passwords don't match.");
    });
  });
});

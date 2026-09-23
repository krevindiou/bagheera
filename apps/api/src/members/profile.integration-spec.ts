import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { member } from '../db/schema';
import type { EmailMessage } from '../email/email-message';
import fr from '../email/i18n/fr';
import { CryptoService } from '../security/crypto.service';
import {
  completeStepUp,
  csrfTokenFor,
  insertMemberWithCredential,
  seedSignedInMember,
  uniqueEmail,
} from '../test-support/auth-fixture';
import { createTestApp, FakeEmailQueue, getDb } from '../test-support/create-test-app';
import { buildEmailChangeToken } from './email-change-token';

function messageOf(res: request.Response): string {
  return (res.body as { message: string }).message;
}

const UPDATE_MESSAGE =
  "If this email isn't already registered to another account, check it for a link to confirm the change.";
const STEP_UP_ERROR = 'Step-up verification is required or has expired.';

describe('POST /members/profile', () => {
  let app: INestApplication<Server>;
  let fakeEmailQueue: FakeEmailQueue;

  beforeAll(async () => {
    ({ app, fakeEmailQueue } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    fakeEmailQueue.enqueue.mockClear();
  });

  async function versionOf(memberId: string): Promise<number> {
    const [row] = await getDb(app)
      .select({ version: member.emailChangeTokenVersion })
      .from(member)
      .where(eq(member.id, memberId));
    return row.version;
  }

  describe('POST /members/profile (start an email change)', () => {
    it('sets pendingEmail and queues a confirmation to the new address, leaving email unchanged', async () => {
      const fixture = await seedSignedInMember(app);
      const newEmail = uniqueEmail('new-address');

      await completeStepUp(app, fixture);
      const csrfToken = await fixture.getCsrfToken();
      const res = await fixture.agent
        .post('/members/profile')
        .set('x-csrf-token', csrfToken)
        .send({ email: newEmail })
        .expect(200);
      expect(messageOf(res)).toBe(UPDATE_MESSAGE);

      const [row] = await getDb(app).select().from(member).where(eq(member.id, fixture.memberId));
      expect(row.email).not.toBe(newEmail);
      expect(row.pendingEmail).toBe(newEmail);
      expect(fakeEmailQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ to: newEmail }),
      );
    });

    it('rejects the call without a prior step-up verification', async () => {
      const { agent, getCsrfToken } = await seedSignedInMember(app);

      const csrfToken = await getCsrfToken();
      const res = await agent
        .post('/members/profile')
        .set('x-csrf-token', csrfToken)
        .send({ email: uniqueEmail() })
        .expect(422);
      expect(messageOf(res)).toBe(STEP_UP_ERROR);
    });

    it('rejects a second call reusing a step-up proof already consumed by the first', async () => {
      const fixture = await seedSignedInMember(app);
      await completeStepUp(app, fixture);
      const csrfToken = await fixture.getCsrfToken();
      await fixture.agent
        .post('/members/profile')
        .set('x-csrf-token', csrfToken)
        .send({ email: uniqueEmail() })
        .expect(200);

      const csrfToken2 = await fixture.getCsrfToken();
      const res = await fixture.agent
        .post('/members/profile')
        .set('x-csrf-token', csrfToken2)
        .send({ email: uniqueEmail() })
        .expect(422);
      expect(messageOf(res)).toBe(STEP_UP_ERROR);
    });

    it('requires authentication', async () => {
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);

      await agent
        .post('/members/profile')
        .set('x-csrf-token', csrfToken)
        .send({ email: uniqueEmail() })
        .expect(401);
    });

    it('no-ops when the "new" email is the same as the current one', async () => {
      const fixture = await seedSignedInMember(app);

      await completeStepUp(app, fixture);
      const csrfToken = await fixture.getCsrfToken();
      await fixture.agent
        .post('/members/profile')
        .set('x-csrf-token', csrfToken)
        .send({ email: fixture.email })
        .expect(200);

      expect(fakeEmailQueue.enqueue).not.toHaveBeenCalled();
      const [row] = await getDb(app)
        .select({ pendingEmail: member.pendingEmail })
        .from(member)
        .where(eq(member.id, fixture.memberId));
      expect(row.pendingEmail).toBeNull();
    });

    // M2: a taken address used to skip the write and the email, which
    // showed in both the response time and the previous link (next test).
    it('handles an address another member holds the same way, but sends its owner a notice, not a link', async () => {
      const other = await insertMemberWithCredential(app, { locale: 'fr' });
      const fixture = await seedSignedInMember(app);
      const before = await versionOf(fixture.memberId);

      await completeStepUp(app, fixture);
      const res = await fixture.mutate('post', '/members/profile', {
        email: other.email.toUpperCase(),
      });
      expect(res.status).toBe(200);
      expect(messageOf(res)).toBe(UPDATE_MESSAGE);

      const sent = fakeEmailQueue.enqueue.mock.calls.map((call) => call[0] as EmailMessage);
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe(other.email);
      expect(sent[0].subject).toBe(fr.addressInUse.subject);
      expect(sent[0].html).not.toContain('confirm-email-change?key=');

      const [row] = await getDb(app)
        .select({ pendingEmail: member.pendingEmail })
        .from(member)
        .where(eq(member.id, fixture.memberId));
      expect(row.pendingEmail).toBe(other.email.toUpperCase());
      expect(await versionOf(fixture.memberId)).toBe(before + 1);
    });

    it("still supersedes the previous link when the new address is taken, so that link can't reveal it", async () => {
      const other = await insertMemberWithCredential(app);
      const fixture = await seedSignedInMember(app);
      const ownMailbox = uniqueEmail('own-mailbox');

      await completeStepUp(app, fixture);
      expect((await fixture.mutate('post', '/members/profile', { email: ownMailbox })).status).toBe(
        200,
      );
      const firstKey = buildEmailChangeToken(
        app.get(CryptoService),
        fixture.memberId,
        ownMailbox,
        await versionOf(fixture.memberId),
      );

      await completeStepUp(app, fixture);
      expect(
        (await fixture.mutate('post', '/members/profile', { email: other.email })).status,
      ).toBe(200);

      const confirmAgent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(confirmAgent);
      await confirmAgent
        .post('/members/profile/confirm-email-change')
        .set('x-csrf-token', csrfToken)
        .send({ key: firstKey })
        .expect(400);
    });
  });

  describe('POST /members/profile/confirm-email-change', () => {
    it('completes a pending change and notifies the old address', async () => {
      const fixture = await seedSignedInMember(app);
      const newEmail = uniqueEmail('confirmed');
      await completeStepUp(app, fixture);
      const startCsrfToken = await fixture.getCsrfToken();
      await fixture.agent
        .post('/members/profile')
        .set('x-csrf-token', startCsrfToken)
        .send({ email: newEmail })
        .expect(200);
      fakeEmailQueue.enqueue.mockClear();

      const [row] = await getDb(app)
        .select({ version: member.emailChangeTokenVersion })
        .from(member)
        .where(eq(member.id, fixture.memberId));
      const key = buildEmailChangeToken(
        app.get(CryptoService),
        fixture.memberId,
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
        .where(eq(member.id, fixture.memberId));
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
      expect(messageOf(replay)).toBe('Email change error (link expired or already used?)');
    });

    it('rejects a malformed key', async () => {
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);

      const res = await agent
        .post('/members/profile/confirm-email-change')
        .set('x-csrf-token', csrfToken)
        .send({ key: 'not-a-real-token' })
        .expect(400);
      expect(messageOf(res)).toBe('Email change error (link expired or already used?)');
    });
  });
});

import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { vi } from 'vitest';
import { member, securityEvent } from '../db/schema';
import type { EmailMessage } from '../email/email-message';
import fr from '../email/i18n/fr';
import { AuditService } from '../security/audit.service';
import { CryptoService } from '../security/crypto.service';
import { SessionRegistryService } from '../session/session-registry.service';
import {
  completeStepUp,
  csrfTokenFor,
  insertMemberWithCredential,
  seedSignedInMember,
  signInWithPasskey,
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
      fakeEmailQueue.enqueue.mockClear();

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

    it('withdraws a pending change when the current address is submitted again, voiding its link', async () => {
      const fixture = await seedSignedInMember(app);
      const newEmail = uniqueEmail('withdrawn');
      await completeStepUp(app, fixture);
      expect((await fixture.mutate('post', '/members/profile', { email: newEmail })).status).toBe(
        200,
      );
      const key = buildEmailChangeToken(
        app.get(CryptoService),
        fixture.memberId,
        newEmail,
        await versionOf(fixture.memberId),
      );

      await completeStepUp(app, fixture);
      expect(
        (await fixture.mutate('post', '/members/profile', { email: fixture.email.toUpperCase() }))
          .status,
      ).toBe(200);

      const confirmAgent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(confirmAgent);
      await confirmAgent
        .post('/members/profile/confirm-email-change')
        .set('x-csrf-token', csrfToken)
        .send({ key })
        .expect(400);
      const [row] = await getDb(app).select().from(member).where(eq(member.id, fixture.memberId));
      expect(row.email).toBe(fixture.email);
      expect(row.pendingEmail).toBeNull();
    });

    // Neither the response time nor the previous link (next test) may
    // reveal a taken address.
    it('handles an address another member holds the same way, but sends its owner a notice, not a link', async () => {
      const other = await insertMemberWithCredential(app, { locale: 'fr' });
      const fixture = await seedSignedInMember(app);
      fakeEmailQueue.enqueue.mockClear();
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
    async function startEmailChange(fixture: Awaited<ReturnType<typeof seedSignedInMember>>) {
      const newEmail = uniqueEmail('confirmed');
      await completeStepUp(app, fixture);
      expect((await fixture.mutate('post', '/members/profile', { email: newEmail })).status).toBe(
        200,
      );
      const key = buildEmailChangeToken(
        app.get(CryptoService),
        fixture.memberId,
        newEmail,
        await versionOf(fixture.memberId),
      );
      return key;
    }

    it("signs out every session of the member when confirmed from a browser that isn't theirs", async () => {
      const fixture = await seedSignedInMember(app);
      const otherDevice = request.agent(app.getHttpServer());
      await signInWithPasskey(app, otherDevice, fixture.credentialId);
      const key = await startEmailChange(fixture);

      const confirmAgent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(confirmAgent);
      await confirmAgent
        .post('/members/profile/confirm-email-change')
        .set('x-csrf-token', csrfToken)
        .send({ key })
        .expect(200);

      await fixture.agent.get('/auth/me').expect(401);
      await otherDevice.get('/auth/me').expect(401);
    });

    it("keeps the confirming session when it is the member's own, and signs out the others", async () => {
      const fixture = await seedSignedInMember(app);
      const otherDevice = request.agent(app.getHttpServer());
      await signInWithPasskey(app, otherDevice, fixture.credentialId);
      const key = await startEmailChange(fixture);

      expect(
        (await fixture.mutate('post', '/members/profile/confirm-email-change', { key })).status,
      ).toBe(200);

      await fixture.agent.get('/auth/me').expect(200);
      await otherDevice.get('/auth/me').expect(401);
    });

    async function emailChangedEvents(memberId: string) {
      return getDb(app)
        .select()
        .from(securityEvent)
        .where(
          and(eq(securityEvent.eventType, 'email_changed'), eq(securityEvent.memberId, memberId)),
        );
    }

    // The registry lives in Valkey; the member's session epoch does not.
    it('still signs out the other sessions and records the change when Valkey cannot revoke them', async () => {
      const fixture = await seedSignedInMember(app);
      const otherDevice = request.agent(app.getHttpServer());
      await signInWithPasskey(app, otherDevice, fixture.credentialId);
      const key = await startEmailChange(fixture);
      const revoke = vi
        .spyOn(app.get(SessionRegistryService), 'revokeOthers')
        .mockRejectedValueOnce(new Error('Connection is closed.'));

      try {
        const res = await fixture.mutate('post', '/members/profile/confirm-email-change', { key });
        expect(res.status).toBe(200);
        expect(revoke).toHaveBeenCalled();
      } finally {
        revoke.mockRestore();
      }

      expect(await emailChangedEvents(fixture.memberId)).toHaveLength(1);
      await fixture.agent.get('/auth/me').expect(200);
      await otherDevice.get('/auth/me').expect(401);
    });

    it('answers without waiting for the old-address notice to be queued', async () => {
      const fixture = await seedSignedInMember(app);
      fakeEmailQueue.enqueue.mockClear();
      const key = await startEmailChange(fixture);
      fakeEmailQueue.enqueue.mockReturnValueOnce(new Promise<void>(() => undefined));

      const confirmAgent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(confirmAgent);
      await confirmAgent
        .post('/members/profile/confirm-email-change')
        .set('x-csrf-token', csrfToken)
        .send({ key })
        .expect(200);
      expect(fakeEmailQueue.enqueue).toHaveBeenCalledTimes(2);
    });

    it('changes nothing when the change cannot be recorded', async () => {
      const fixture = await seedSignedInMember(app);
      const otherDevice = request.agent(app.getHttpServer());
      await signInWithPasskey(app, otherDevice, fixture.credentialId);
      const key = await startEmailChange(fixture);
      const recordIn = vi
        .spyOn(app.get(AuditService), 'recordIn')
        .mockRejectedValueOnce(new Error('insert failed'));

      try {
        const res = await fixture.mutate('post', '/members/profile/confirm-email-change', { key });
        expect(res.status).toBe(500);
      } finally {
        recordIn.mockRestore();
      }

      const [row] = await getDb(app).select().from(member).where(eq(member.id, fixture.memberId));
      expect(row.email).toBe(fixture.email);
      expect(row.sessionEpoch).toBe(0);
      expect(await emailChangedEvents(fixture.memberId)).toHaveLength(0);
      await otherDevice.get('/auth/me').expect(200);
      // The link is still good.
      expect(
        (await fixture.mutate('post', '/members/profile/confirm-email-change', { key })).status,
      ).toBe(200);
    });

    // A session already ended by an earlier change must not be revived by
    // confirming from it.
    it('does not keep a confirming session of the member that an earlier change ended', async () => {
      const fixture = await seedSignedInMember(app);
      const key = await startEmailChange(fixture);
      await getDb(app)
        .update(member)
        .set({ sessionEpoch: sql`${member.sessionEpoch} + 1` })
        .where(eq(member.id, fixture.memberId));

      expect(
        (await fixture.mutate('post', '/members/profile/confirm-email-change', { key })).status,
      ).toBe(200);

      await fixture.agent.get('/auth/me').expect(401);
    });

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

    it('still completes the change and records it when the old-address notice cannot be queued', async () => {
      const fixture = await seedSignedInMember(app);
      const newEmail = uniqueEmail('queue-down');
      await completeStepUp(app, fixture);
      const startCsrfToken = await fixture.getCsrfToken();
      await fixture.agent
        .post('/members/profile')
        .set('x-csrf-token', startCsrfToken)
        .send({ email: newEmail })
        .expect(200);

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
      fakeEmailQueue.enqueue.mockRejectedValueOnce(new Error('Connection is closed.'));

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
      const events = await getDb(app)
        .select()
        .from(securityEvent)
        .where(
          and(
            eq(securityEvent.eventType, 'email_changed'),
            eq(securityEvent.memberId, fixture.memberId),
          ),
        );
      expect(events).toHaveLength(1);
    });

    it('lets only one of two confirmations racing on the same link through', async () => {
      const fixture = await seedSignedInMember(app);
      const newEmail = uniqueEmail('raced');
      await completeStepUp(app, fixture);
      const startCsrfToken = await fixture.getCsrfToken();
      await fixture.agent
        .post('/members/profile')
        .set('x-csrf-token', startCsrfToken)
        .send({ email: newEmail })
        .expect(200);
      fakeEmailQueue.enqueue.mockClear();
      const key = buildEmailChangeToken(
        app.get(CryptoService),
        fixture.memberId,
        newEmail,
        await versionOf(fixture.memberId),
      );
      const agents = await Promise.all(
        [1, 2].map(async () => {
          const agent = request.agent(app.getHttpServer());
          return { agent, csrfToken: await csrfTokenFor(agent) };
        }),
      );
      // Supertest otherwise opens and closes a listener on the shared server
      // per request, which requests in flight together trip over.
      const server = app.getHttpServer();
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

      const db = getDb(app);
      let pending: Promise<request.Response[]> | undefined;
      try {
        // Holding the member row lets both confirmations read the pending
        // change, then queues both on their UPDATE until it is released.
        await db.transaction(async (tx) => {
          await tx.execute(
            sql`select 1 from ${member} where ${member.id} = ${fixture.memberId} for update`,
          );
          // `.then` sends each request now, while the row is held.
          pending = Promise.all(
            agents.map(({ agent, csrfToken }) =>
              agent
                .post('/members/profile/confirm-email-change')
                .set('x-csrf-token', csrfToken)
                .send({ key })
                .then((res) => res),
            ),
          );
          for (let waited = 0; ; waited += 20) {
            const { rows } = await db.execute<{ waiting: number }>(
              sql`select count(*)::int as waiting from pg_stat_activity
                  where datname = current_database() and wait_event_type = 'Lock'`,
            );
            if (rows[0].waiting === 2) break;
            if (waited > 5000) throw new Error('confirmations never queued on the row lock');
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
        });
        const submits = await pending!;
        expect(submits.map((res) => res.status).sort()).toEqual([200, 400]);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
      expect(fakeEmailQueue.enqueue).toHaveBeenCalledTimes(1);
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

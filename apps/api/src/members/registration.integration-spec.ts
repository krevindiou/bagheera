import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import type IORedis from 'ioredis';
import { member, securityEvent } from '../db/schema';
import type { EmailMessage, SignupRequest } from '../email/email-message';
import { RATE_LIMIT_VALKEY_CLIENT } from '../security/rate-limit-valkey-client.provider';
import {
  completeStepUp,
  csrfTokenFor,
  insertMemberWithCredential,
  seedSignedInMember,
  uniqueEmail,
} from '../test-support/auth-fixture';
import { createTestApp, FakeEmailQueue, getDb } from '../test-support/create-test-app';
import { SIGNUP_MAIL_DAILY_CAP } from './signup-mail-throttle';
import { SignupRequestService } from './signup-request.service';
import { SIGNUP_TOKEN_TTL_MS } from './signup-token';

function messageOf(res: request.Response): string {
  return (res.body as { message: string }).message;
}

const REGISTER_MESSAGE =
  "If this email isn't already registered, you'll receive a link to activate your account.";

describe('registration', () => {
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
    fakeEmailQueue.enqueueSignupRequest.mockClear();
  });

  function sentEmails(): EmailMessage[] {
    return fakeEmailQueue.enqueue.mock.calls.map((call) => call[0] as EmailMessage);
  }

  describe('POST /members/register', () => {
    async function register(body: object): Promise<request.Response> {
      const agent = request.agent(app.getHttpServer());
      const csrfToken = await csrfTokenFor(agent);
      return agent.post('/members/register').set('x-csrf-token', csrfToken).send(body);
    }

    it('queues a sign-up request and creates no member row yet', async () => {
      const email = uniqueEmail();

      const res = await register({ email, country: 'fr', locale: 'fr' });

      expect(res.status).toBe(201);
      expect(messageOf(res)).toBe(REGISTER_MESSAGE);
      const [[queued]] = fakeEmailQueue.enqueueSignupRequest.mock.calls as [[SignupRequest]];
      expect(queued).toMatchObject({ email, country: 'FR', locale: 'fr' });
      // For the audit row the worker writes once it knows what it sent.
      expect(queued.sourceAddress).toContain('127.0.0.1');
      // No member row until the emailed link's passkey ceremony completes.
      const rows = await getDb(app).select().from(member).where(eq(member.email, email));
      expect(rows).toHaveLength(0);
    });

    // A lookup on the request path would leak registration through timing.
    it('does exactly the same for an already-registered email', async () => {
      const { email } = await insertMemberWithCredential(app);

      const res = await register({ email, country: 'FR' });

      expect(res.status).toBe(201);
      expect(messageOf(res)).toBe(REGISTER_MESSAGE);
      expect(fakeEmailQueue.enqueueSignupRequest).toHaveBeenCalledWith(
        expect.objectContaining({ email, locale: 'en' }),
      );
      expect(fakeEmailQueue.enqueue).not.toHaveBeenCalled();
    });

    it('rejects an unsupported locale', async () => {
      const res = await register({ email: uniqueEmail(), country: 'FR', locale: 'de' });
      expect(res.status).toBe(400);
      expect(fakeEmailQueue.enqueueSignupRequest).not.toHaveBeenCalled();
    });

    it("queues the browser's time zone along with the request", async () => {
      const email = uniqueEmail();

      const res = await register({ email, country: 'FR', timeZone: 'Europe/Paris' });

      expect(res.status).toBe(201);

      expect(fakeEmailQueue.enqueueSignupRequest).toHaveBeenCalledWith(
        expect.objectContaining({ email, timeZone: 'Europe/Paris' }),
      );
    });

    // A browser zone this server doesn't know must not block sign-up.
    it('drops an unknown time zone instead of rejecting the request', async () => {
      const email = uniqueEmail();

      const res = await register({ email, country: 'FR', timeZone: 'Mars/Base' });

      expect(res.status).toBe(201);
      const [[queued]] = fakeEmailQueue.enqueueSignupRequest.mock.calls as [[SignupRequest]];
      expect(queued).toMatchObject({ email });
      expect(queued.timeZone).toBeUndefined();
    });

    it('rejects an invalid country code', async () => {
      const res = await register({ email: uniqueEmail(), country: 'FRA' });
      expect(res.status).toBe(400);
      expect(fakeEmailQueue.enqueueSignupRequest).not.toHaveBeenCalled();
    });
  });

  describe('SignupRequestService (the worker side)', () => {
    it('emails a new address its sign-up link and records signup_confirmation_issued', async () => {
      const email = uniqueEmail();
      const sourceAddress = '203.0.113.7';

      await app
        .get(SignupRequestService)
        .handle({ email, country: 'FR', locale: 'fr', sourceAddress });

      expect(sentEmails()).toHaveLength(1);
      expect(sentEmails()[0].to).toBe(email);
      expect(sentEmails()[0].html).toContain('/fr/activate?key=');
      const events = await getDb(app)
        .select({ memberId: securityEvent.memberId })
        .from(securityEvent)
        .where(
          and(
            eq(securityEvent.eventType, 'signup_confirmation_issued'),
            eq(securityEvent.sourceAddress, sourceAddress),
          ),
        );
      expect(events).toContainEqual({ memberId: null });
    });

    it('tells a registered address it already has an account, whatever case it was typed in', async () => {
      const { email } = await insertMemberWithCredential(app, { locale: 'fr' });

      await app.get(SignupRequestService).handle({
        email: email.toUpperCase(),
        country: 'FR',
        locale: 'en',
        sourceAddress: '203.0.113.8',
      });

      expect(sentEmails()).toHaveLength(1);
      expect(sentEmails()[0].to).toBe(email);
      expect(sentEmails()[0].html).toContain('/fr/sign-in');
      expect(sentEmails()[0].html).not.toContain('activate?key=');
    });

    it.each([
      ['a new address', () => Promise.resolve(uniqueEmail())],
      ['a registered address', async () => (await insertMemberWithCredential(app)).email],
    ])('mails %s only once while its cooldown runs', async (_, emailFor) => {
      const email = await emailFor();
      const handler = app.get(SignupRequestService);

      for (let i = 0; i < 3; i++) {
        await handler.handle({ email, country: 'FR', locale: 'en', sourceAddress: '203.0.113.9' });
      }

      expect(sentEmails()).toHaveLength(1);
      expect(sentEmails()[0].to).toBe(email);
      const valkey = app.get<IORedis>(RATE_LIMIT_VALKEY_CLIENT);
      const [cooldownKey] = await valkey.keys('rl:signup-mail:cooldown:*');
      const ttl = await valkey.pttl(cooldownKey);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(SIGNUP_TOKEN_TTL_MS);
    });

    it('stops sign-up mail once the daily cap is spent, but no other mail', async () => {
      const valkey = app.get<IORedis>(RATE_LIMIT_VALKEY_CLIENT);
      const dailyKey = `rl:signup-mail:day:${new Date().toISOString().slice(0, 10)}`;
      await valkey.set(dailyKey, SIGNUP_MAIL_DAILY_CAP);
      try {
        await app.get(SignupRequestService).handle({
          email: uniqueEmail(),
          country: 'FR',
          locale: 'en',
          sourceAddress: '203.0.113.10',
        });
        expect(fakeEmailQueue.enqueue).not.toHaveBeenCalled();

        const fixture = await seedSignedInMember(app);
        const newEmail = uniqueEmail('new-address');
        await completeStepUp(app, fixture);
        const res = await fixture.mutate('post', '/members/profile', { email: newEmail });
        expect(res.status).toBe(200);
        expect(fakeEmailQueue.enqueue).toHaveBeenCalledWith(
          expect.objectContaining({ to: newEmail }),
        );
      } finally {
        await valkey.del(dailyKey);
      }
    });
  });
});

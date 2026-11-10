import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, eq } from 'drizzle-orm';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type IORedis from 'ioredis';
import request from 'supertest';
import { securityEvent } from '../db/schema';
import type { SecurityEventType } from '../security/audit.service';
import { SessionRegistryService } from '../session/session-registry.service';
import { SESSION_KEY_PREFIX, VALKEY_CLIENT } from '../session/session.constants';
import {
  completeStepUp,
  seedSignedInMember,
  signInWithPasskey,
  type SignedInFixture,
} from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';
import type { SessionSummaryDto } from './dto/session-summary.dto';

const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0';

type SessionSummary = Omit<SessionSummaryDto, 'signedInAt' | 'lastActiveAt'> & {
  signedInAt: string;
  lastActiveAt: string;
};

const STEP_UP_ERROR = 'Step-up verification is required or has expired.';

describe('/auth/sessions', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    // As in main.ts, so a test can move a session to another network.
    (app as unknown as NestExpressApplication).set('trust proxy', 1);
  });

  afterAll(async () => {
    await app.close();
  });

  // Another browser signed in to the fixture's account.
  async function signInElsewhere(fixture: SignedInFixture, userAgent = FIREFOX_LINUX) {
    const agent = request.agent(app.getHttpServer()).set('User-Agent', userAgent);
    await signInWithPasskey(app, agent, fixture.credentialId);
    await agent.get('/auth/me').expect(200);
    return agent;
  }

  async function listSessions(fixture: SignedInFixture): Promise<SessionSummary[]> {
    const res = await fixture.agent.get('/auth/sessions').expect(200);
    return res.body as SessionSummary[];
  }

  async function otherSession(fixture: SignedInFixture): Promise<SessionSummary> {
    const other = (await listSessions(fixture)).find((session) => !session.current);
    expect(other).toBeDefined();
    return other!;
  }

  async function events(eventType: SecurityEventType, memberId: string) {
    return getDb(app)
      .select()
      .from(securityEvent)
      .where(and(eq(securityEvent.eventType, eventType), eq(securityEvent.memberId, memberId)));
  }

  async function eventCount(eventType: SecurityEventType, memberId: string) {
    return (await events(eventType, memberId)).length;
  }

  describe('GET /auth/sessions', () => {
    it("lists the member's own sessions, the current one first, with browser, OS and address", async () => {
      const fixture = await seedSignedInMember(app);
      await signInElsewhere(fixture);
      const stranger = await seedSignedInMember(app);
      await signInElsewhere(stranger);

      const sessions = await listSessions(fixture);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].current).toBe(true);
      expect(sessions[1]).toMatchObject({ current: false, browser: 'Firefox', os: 'Linux' });
      for (const session of sessions) {
        expect(typeof session.ipAddress).toBe('string');
        expect(Date.parse(session.lastActiveAt)).toBeGreaterThanOrEqual(
          Date.parse(session.signedInAt),
        );
      }
    });

    // The session id is the cookie's secret.
    it('never hands out a session id', async () => {
      const fixture = await seedSignedInMember(app);
      await signInElsewhere(fixture);
      const valkey = app.get<IORedis>(VALKEY_CLIENT);

      for (const session of await listSessions(fixture)) {
        expect(session.id).toMatch(/^[0-9a-f]{32}$/);
        expect(await valkey.exists(`${SESSION_KEY_PREFIX}${session.id}`)).toBe(0);
      }
    });

    it('leaves out a session a session-epoch bump already ended', async () => {
      const fixture = await seedSignedInMember(app);
      await signInElsewhere(fixture);
      const valkey = app.get<IORedis>(VALKEY_CLIENT);
      const stored = await app.get(SessionRegistryService).sessionsOf(fixture.memberId);
      const ended = stored.find((session) => session.data.client?.userAgent === FIREFOX_LINUX);
      expect(ended).toBeDefined();
      await valkey.set(
        `${SESSION_KEY_PREFIX}${ended!.id}`,
        JSON.stringify({ ...ended!.data, sessionEpoch: 99 }),
        'KEEPTTL',
      );

      const sessions = await listSessions(fixture);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].current).toBe(true);
    });

    it('requires authentication', async () => {
      await request(app.getHttpServer()).get('/auth/sessions').expect(401);
    });
  });

  describe('DELETE /auth/sessions/:id', () => {
    it('signs out that session only, and records session_revoked', async () => {
      const fixture = await seedSignedInMember(app);
      const elsewhere = await signInElsewhere(fixture);
      const kept = await signInElsewhere(fixture, 'kept-browser');
      const target = (await listSessions(fixture)).find((session) => session.browser === 'Firefox');

      await completeStepUp(app, fixture);
      const res = await fixture.mutate('delete', `/auth/sessions/${target!.id}`);
      expect(res.status).toBe(200);

      await elsewhere.get('/auth/me').expect(401);
      await kept.get('/auth/me').expect(200);
      await fixture.agent.get('/auth/me').expect(200);
      expect(await eventCount('session_revoked', fixture.memberId)).toBe(1);
    });

    // A stolen session alone must not sign the owner out.
    it('refuses without a fresh step-up', async () => {
      const fixture = await seedSignedInMember(app);
      const elsewhere = await signInElsewhere(fixture);
      const target = await otherSession(fixture);

      const res = await fixture.mutate('delete', `/auth/sessions/${target.id}`);
      expect(res.status).toBe(422);
      expect((res.body as { message: string }).message).toBe(STEP_UP_ERROR);
      await elsewhere.get('/auth/me').expect(200);
    });

    it('404s on the current session, an unknown id and another member’s session', async () => {
      const fixture = await seedSignedInMember(app);
      const stranger = await seedSignedInMember(app);
      const strangerElsewhere = await signInElsewhere(stranger);
      const current = (await listSessions(fixture)).find((session) => session.current);
      const strangers = await otherSession(stranger);

      for (const id of [current!.id, '0'.repeat(32), strangers.id]) {
        await completeStepUp(app, fixture);
        expect((await fixture.mutate('delete', `/auth/sessions/${id}`)).status).toBe(404);
      }
      await fixture.agent.get('/auth/me').expect(200);
      await strangerElsewhere.get('/auth/me').expect(200);
    });
  });

  describe('DELETE /auth/sessions', () => {
    it('signs out every other session, keeps this one, and records other_sessions_revoked', async () => {
      const fixture = await seedSignedInMember(app);
      const first = await signInElsewhere(fixture);
      const second = await signInElsewhere(fixture, 'another-browser');

      await completeStepUp(app, fixture);
      expect((await fixture.mutate('delete', '/auth/sessions')).status).toBe(200);

      await first.get('/auth/me').expect(401);
      await second.get('/auth/me').expect(401);
      await fixture.agent.get('/auth/me').expect(200);
      expect(await listSessions(fixture)).toHaveLength(1);
      expect(await eventCount('other_sessions_revoked', fixture.memberId)).toBe(1);
    });

    it('refuses without a fresh step-up', async () => {
      const fixture = await seedSignedInMember(app);
      const elsewhere = await signInElsewhere(fixture);

      const res = await fixture.mutate('delete', '/auth/sessions');
      expect(res.status).toBe(422);
      await elsewhere.get('/auth/me').expect(200);
    });
  });

  describe('client binding', () => {
    const CHROME_WINDOWS =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

    // The session cookie copied into another browser.
    it('ends a session used from another browser, and records session_device_mismatch', async () => {
      const fixture = await seedSignedInMember(app);
      const elsewhere = await signInElsewhere(fixture);

      await elsewhere.get('/auth/me').set('User-Agent', CHROME_WINDOWS).expect(401);

      await elsewhere.get('/auth/me').expect(401);
      expect(await listSessions(fixture)).toHaveLength(1);
      expect((await events('session_device_mismatch', fixture.memberId))[0].details).toEqual({
        signedInBrowser: 'Firefox',
        signedInOs: 'Linux',
        browser: 'Chrome',
        os: 'Windows',
      });
    });

    it('keeps a session whose browser updated itself', async () => {
      const fixture = await seedSignedInMember(app);
      const elsewhere = await signInElsewhere(fixture);

      await elsewhere
        .get('/auth/me')
        .set('User-Agent', FIREFOX_LINUX.replaceAll('132.0', '133.0'))
        .expect(200);
      expect(await eventCount('session_device_mismatch', fixture.memberId)).toBe(0);
    });

    it('keeps a session on a new network, records it once and lists its latest address', async () => {
      const fixture = await seedSignedInMember(app);
      const elsewhere = await signInElsewhere(fixture);
      const signInAddress = (await otherSession(fixture)).ipAddress;

      await elsewhere.get('/auth/me').set('X-Forwarded-For', '192.0.2.40').expect(200);
      await elsewhere.get('/auth/me').set('X-Forwarded-For', '192.0.2.40').expect(200);

      const recorded = await events('session_address_changed', fixture.memberId);
      expect(recorded).toHaveLength(1);
      expect(recorded[0]).toMatchObject({
        sourceAddress: '192.0.2.40',
        details: { previousAddress: signInAddress },
      });
      expect(await otherSession(fixture)).toMatchObject({
        ipAddress: signInAddress,
        lastIpAddress: '192.0.2.40',
      });
    });
  });
});

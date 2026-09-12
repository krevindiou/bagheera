import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { desc, eq } from 'drizzle-orm';
import request from 'supertest';
import { securityEvent } from '../db/schema';
import { csrfTokenFor, seedSignedInMember, uniqueEmail } from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';

async function attemptSignIn(
  agent: ReturnType<typeof request.agent>,
  csrfToken: string,
  email: string,
): Promise<number> {
  const res = await agent
    .post('/auth/sign-in')
    .set('x-csrf-token', csrfToken)
    .send({ email, password: 'wrong-password-1' });
  return res.status;
}

async function latestSignInThrottledEvent(app: INestApplication<Server>) {
  const [event] = await getDb(app)
    .select()
    .from(securityEvent)
    .where(eq(securityEvent.eventType, 'sign_in_throttled'))
    .orderBy(desc(securityEvent.createdAt))
    .limit(1);
  return event;
}

describe('rate limiting', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  // Sign-in's SignInThrottleAuditFilter deliberately masks a throttled
  // attempt as the same generic 401 a wrong password produces (anti-
  // enumeration: a caller must not be able to tell "you're locked out"
  // from "wrong password") — it still records a distinct sign_in_throttled
  // audit event, which is what these sign-in-specific tests check instead
  // of the (intentionally invisible) HTTP status.
  it('locks out the identifier dimension once its budget is exhausted', async () => {
    const email = uniqueEmail('ratelimit');
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);
    const before = await latestSignInThrottledEvent(app);

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push(await attemptSignIn(agent, csrfToken, email));
    }
    // Every attempt looks like an ordinary wrong-password failure —
    // sign-in's own @RateLimit is { points: 5, identifierField: 'email' },
    // so the 6th silently trips the budget behind that same 401.
    expect(statuses).toEqual([401, 401, 401, 401, 401, 401]);

    const after = await latestSignInThrottledEvent(app);
    expect(after?.id).not.toBe(before?.id);
  });

  it('shares the identifier lockout across letter case (cbab0fd6 regression)', async () => {
    const label = `CaseTest-${Date.now()}`;
    const upper = `${label}@Example.Test`;
    const lower = upper.toLowerCase();

    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);
    for (let i = 0; i < 6; i++) {
      await attemptSignIn(agent, csrfToken, upper);
    }
    const throttledOnUpper = await latestSignInThrottledEvent(app);
    expect(throttledOnUpper).toBeDefined();

    // A different case variant of the same email is blocked immediately —
    // one more throttled event, not a fresh ordinary failure — proving both
    // share one normalized dimension key, not two independent ones an
    // attacker could rotate between.
    await attemptSignIn(agent, csrfToken, lower);
    const throttledOnLower = await latestSignInThrottledEvent(app);
    expect(throttledOnLower).toBeDefined();
    expect(throttledOnLower.id).not.toBe(throttledOnUpper.id);
  });

  it('applies an explicit @RateLimit override distinct from the default budget', async () => {
    // WebauthnRegistrationController.options() declares
    // @RateLimit({ points: 10, durationSeconds: 60 }), no identifierField —
    // only the IP dimension applies, budget 10 (not ipPointsFor's ×4
    // multiplier, which only kicks in when identifierField is set). No
    // masking filter here, so a real 429 surfaces once exhausted.
    const { agent, getCsrfToken } = await seedSignedInMember(app);

    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const csrfToken = await getCsrfToken();
      const res = await agent.post('/webauthn/registration/options').set('x-csrf-token', csrfToken);
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('never throttles a route marked @SkipRateLimit, however many times it is called', async () => {
    const { agent, getCsrfToken } = await seedSignedInMember(app);

    for (let i = 0; i < 15; i++) {
      const csrfToken = await getCsrfToken();
      await agent
        .post('/banks/choice')
        .set('x-csrf-token', csrfToken)
        .send({ name: `Bank ${i}` })
        .expect(200);
    }
  });

  it("scopes the identifier dimension to its own route — exhausting sign-in's budget doesn't affect registration", async () => {
    const email = uniqueEmail('scoped');
    const signInAgent = request.agent(app.getHttpServer());
    const signInCsrf = await csrfTokenFor(signInAgent);
    for (let i = 0; i < 6; i++) {
      await attemptSignIn(signInAgent, signInCsrf, email);
    }
    expect(await latestSignInThrottledEvent(app)).toBeDefined();

    const registerAgent = request.agent(app.getHttpServer());
    const registerCsrf = await csrfTokenFor(registerAgent);
    const res = await registerAgent
      .post('/members/register')
      .set('x-csrf-token', registerCsrf)
      .send({
        email,
        password: 'a-real-password-1',
        passwordConfirmation: 'a-real-password-1',
        country: 'FR',
      });
    expect(res.status).toBe(201);
  });
});

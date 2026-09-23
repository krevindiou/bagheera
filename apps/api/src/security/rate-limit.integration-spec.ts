import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { csrfTokenFor, seedSignedInMember, uniqueEmail } from '../test-support/auth-fixture';
import { createTestApp } from '../test-support/create-test-app';

async function attemptAuthenticationOptions(
  agent: ReturnType<typeof request.agent>,
  csrfToken: string,
  email: string,
): Promise<number> {
  const res = await agent
    .post('/webauthn/authentication/options')
    .set('x-csrf-token', csrfToken)
    .send({ email });
  return res.status;
}

describe('rate limiting', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  // WebauthnAuthenticationController.options() declares
  // @RateLimit({ points: 5, durationSeconds: 60, identifierField: 'email' })
  // — same shape the old password sign-in endpoint used. Unlike sign-in,
  // nothing masks a throttled attempt here: the route's response is already
  // identical for a known vs. unknown email (see
  // webauthn-authentication.service.ts's anti-enumeration comment), so a
  // distinct 429 once the budget trips leaks nothing extra.
  it('locks out the identifier dimension once its budget is exhausted', async () => {
    const email = uniqueEmail('ratelimit');
    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push(await attemptAuthenticationOptions(agent, csrfToken, email));
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it('shares the identifier lockout across letter case (cbab0fd6 regression)', async () => {
    const label = `CaseTest-${Date.now()}`;
    const upper = `${label}@Example.Test`;
    const lower = upper.toLowerCase();

    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);
    for (let i = 0; i < 6; i++) {
      await attemptAuthenticationOptions(agent, csrfToken, upper);
    }
    const throttledOnUpper = await attemptAuthenticationOptions(agent, csrfToken, upper);
    expect(throttledOnUpper).toBe(429);

    // A different case variant of the same email is blocked immediately —
    // proving both share one normalized dimension key, not two independent
    // ones an attacker could rotate between.
    const throttledOnLower = await attemptAuthenticationOptions(agent, csrfToken, lower);
    expect(throttledOnLower).toBe(429);
  });

  it('applies an explicit @RateLimit override distinct from the default budget', async () => {
    // WebauthnStepUpController.options() declares
    // @RateLimit({ points: 10, durationSeconds: 60 }), no identifierField —
    // only the IP dimension applies, budget 10 (not ipPointsFor's ×4
    // multiplier, which only kicks in when identifierField is set). No
    // masking filter here, so a real 429 surfaces once exhausted. (Not
    // registration options, same budget: those also need a fresh step-up
    // per call, which would muddy what's being measured here.)
    const { agent, getCsrfToken } = await seedSignedInMember(app);

    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const csrfToken = await getCsrfToken();
      const res = await agent.post('/webauthn/step-up/options').set('x-csrf-token', csrfToken);
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

  it("scopes the identifier dimension to its own route — exhausting authentication's budget doesn't affect registration", async () => {
    const email = uniqueEmail('scoped');
    const authAgent = request.agent(app.getHttpServer());
    const authCsrf = await csrfTokenFor(authAgent);
    for (let i = 0; i < 6; i++) {
      await attemptAuthenticationOptions(authAgent, authCsrf, email);
    }
    expect(await attemptAuthenticationOptions(authAgent, authCsrf, email)).toBe(429);

    const registerAgent = request.agent(app.getHttpServer());
    const registerCsrf = await csrfTokenFor(registerAgent);
    const res = await registerAgent
      .post('/members/register')
      .set('x-csrf-token', registerCsrf)
      .send({ email, country: 'FR' });
    expect(res.status).toBe(201);
  });
});

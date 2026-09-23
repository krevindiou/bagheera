import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { createTestApp } from '../test-support/create-test-app';

// This route is exercised as incidental plumbing by nearly every other
// spec in the suite (every mutate()/csrfTokenFor() call in
// test-support/auth-fixture.ts hits it) — these tests instead pin its own
// direct contract and the one subtle mechanism it relies on.
describe('GET /auth/csrf-token', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('mints a token with no auth required', async () => {
    // Bare `request(...)`, no agent/cookie — proves the @Public() route
    // is reachable from a cold, anonymous caller (it has to be: the
    // sign-in and registration forms both need a token before any session
    // exists).
    const res = await request(app.getHttpServer()).get('/auth/csrf-token');
    expect(res.status).toBe(200);
    expect(typeof (res.body as { csrfToken?: unknown }).csrfToken).toBe('string');
    expect((res.body as { csrfToken: string }).csrfToken.length).toBeGreaterThan(0);
  });

  it("keeps a fresh agent's very first-ever session alive for the next request (csrfIssued persistence)", async () => {
    // csrf-token.controller.ts sets `req.session.csrfIssued = true`
    // specifically so this works: without it, express-session's
    // saveUninitialized:false would drop a session that this GET is the
    // only thing to ever touch, and the id the token's HMAC is bound to
    // would silently change before the client's next request arrives.
    const agent = request.agent(app.getHttpServer());
    const res = await agent.get('/auth/csrf-token').expect(200);
    const token = (res.body as { csrfToken: string }).csrfToken;

    // Any cheap public mutation would do — the point is only that the
    // request isn't rejected at the CSRF layer. A 403 here would mean the
    // session was dropped between the two calls and the token no longer
    // matches.
    const optionsRes = await agent
      .post('/webauthn/authentication/options')
      .set('x-csrf-token', token);
    expect(optionsRes.status).not.toBe(403);
  });
});

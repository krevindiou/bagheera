import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { createTestApp } from '../test-support/create-test-app';

describe('GET /auth/csrf-token', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('mints a token with no auth required', async () => {
    // Sign-in and registration need a token before any session exists.
    const res = await request(app.getHttpServer()).get('/auth/csrf-token');
    expect(res.status).toBe(200);
    expect(typeof (res.body as { csrfToken?: unknown }).csrfToken).toBe('string');
    expect((res.body as { csrfToken: string }).csrfToken.length).toBeGreaterThan(0);
  });

  it("keeps a fresh agent's very first-ever session alive for the next request (csrfIssued persistence)", async () => {
    // Relies on `csrfIssued` persisting the session the token is bound to.
    const agent = request.agent(app.getHttpServer());
    const res = await agent.get('/auth/csrf-token').expect(200);
    const token = (res.body as { csrfToken: string }).csrfToken;

    // Any cheap public mutation: only the CSRF layer's verdict matters.
    const optionsRes = await agent
      .post('/webauthn/authentication/options')
      .set('x-csrf-token', token);
    expect(optionsRes.status).not.toBe(403);
  });

  // The one way an anonymous caller adds a key to Valkey.
  it('throttles minting for callers without a session, 30 a minute per IP', async () => {
    for (let i = 0; i < 30; i++) {
      await request(app.getHttpServer()).get('/auth/csrf-token').expect(200);
    }
    await request(app.getHttpServer()).get('/auth/csrf-token').expect(429);
  });

  // The SPA mints a token per mutation (apps/web/src/api/client.ts).
  it('never throttles a caller whose session already exists', async () => {
    const agent = request.agent(app.getHttpServer());
    for (let i = 0; i < 40; i++) {
      await agent.get('/auth/csrf-token').expect(200);
    }
  });
});

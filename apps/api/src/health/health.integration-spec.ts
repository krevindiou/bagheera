import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import type { Pool } from 'pg';
import request from 'supertest';
import { PG_POOL } from '../db/db.constants';
import { createTestApp } from '../test-support/create-test-app';

// Kamal's zero-downtime deploy polls this exact path (config/deploy.yml's
// proxy.healthcheck.path: /health) to decide when a freshly booted
// container is ready to take traffic — the one endpoint in this app that's
// load-bearing for deploys rather than for a member's own workflow.
describe('GET /health', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 ok when the database is reachable, with no auth required', async () => {
    // Deliberately a bare `request(...)`, no agent/cookie/CSRF — proves the
    // @Public() route really is reachable from a cold, anonymous caller,
    // the exact shape Kamal's healthcheck poller uses.
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  // Polled every few seconds, forever: session.module.ts keeps it clear of
  // the session middleware. With rolling cookies, a response that so much
  // as loaded the caller's session would send its cookie again.
  it('never creates, loads or refreshes a session', async () => {
    const cold = await request(app.getHttpServer()).get('/health').expect(200);
    expect(cold.headers['set-cookie']).toBeUndefined();

    const agent = request.agent(app.getHttpServer());
    await agent.get('/auth/csrf-token').expect(200);
    const withSession = await agent.get('/health').expect(200);
    expect(withSession.headers['set-cookie']).toBeUndefined();
  });

  // The dangerous direction: if this ever regressed into always returning
  // 200, Kamal would cut traffic to a container that can't reach its
  // database — a silent production incident, not a loud one.
  //
  // Proven by ending this test's own pg Pool directly rather than
  // stopping the shared Testcontainers Postgres — db.module.ts's PG_POOL
  // provider is a `useFactory` that builds a fresh `new Pool(...)` per
  // compiled module, and each *.integration-spec.ts file's createTestApp()
  // compiles its own AppModule instance, so this only tears down *this*
  // file's own connection, not Postgres itself or any other spec file's.
  //
  // Last test in the file: nothing after this can use `app` for a
  // DB-backed call again. afterAll's app.close() stays safe regardless —
  // DbModule.onModuleDestroy() checks `pool.ended` before ending it again.
  it('returns 503 when the database is unreachable', async () => {
    const pool = app.get<Pool>(PG_POOL);
    await pool.end();

    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(503);
  });
});

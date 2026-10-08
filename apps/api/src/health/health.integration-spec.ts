import { INestApplication } from '@nestjs/common';
import { vi } from 'vitest';
import type { Server } from 'http';
import type { Pool } from 'pg';
import request from 'supertest';
import { PG_POOL } from '../db/db.constants';
import type IORedis from 'ioredis';
import { VALKEY_CLIENT } from '../session/session.constants';
import { createTestApp } from '../test-support/create-test-app';

// kamal-proxy polls this (config/deploy.api.yml) to decide when a new
// container takes traffic.
describe('GET /health', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 ok when the database is reachable, with no auth required', async () => {
    // A cold, anonymous caller, like the healthcheck poller.
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

  // Every request needs Valkey (sessions, rate limits), so a container that
  // can't reach it must be pulled out of rotation like one without a database.
  it('returns 503 when Valkey does not answer', async () => {
    const ping = vi
      .spyOn(app.get<IORedis>(VALKEY_CLIENT), 'ping')
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await request(app.getHttpServer()).get('/health');

    expect(res.status).toBe(503);
    ping.mockRestore();
  });

  // Ends this app's own pool (each spec compiles its own), not the shared
  // Postgres. Must stay last: `app` can't reach the database afterwards.
  it('returns 503 when the database is unreachable', async () => {
    const pool = app.get<Pool>(PG_POOL);
    await pool.end();

    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(503);
  });
});

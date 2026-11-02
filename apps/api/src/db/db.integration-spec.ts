import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import type { Pool } from 'pg';
import { createTestApp } from '../test-support/create-test-app';
import { PG_POOL } from './db.constants';
import { POOL_CONNECTION_TIMEOUT_MS, STATEMENT_TIMEOUT_MS } from './db.module';

describe('DbModule', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it("caps every statement on the app's connections with a server-side timeout", async () => {
    const { rows } = await app
      .get<Pool>(PG_POOL)
      .query<{ statement_timeout: string }>('show statement_timeout');
    expect(rows[0].statement_timeout).toBe(`${STATEMENT_TIMEOUT_MS / 1000}s`);
  });

  it(
    'fails a request waiting for a connection once the pool stays full too long',
    async () => {
      const pool = app.get<Pool>(PG_POOL);
      const held = await Promise.all(
        Array.from({ length: pool.options.max }, () => pool.connect()),
      );
      try {
        const startedAt = Date.now();
        await expect(pool.connect()).rejects.toThrow(/timeout/i);
        expect(Date.now() - startedAt).toBeGreaterThanOrEqual(POOL_CONNECTION_TIMEOUT_MS - 100);
      } finally {
        held.forEach((client) => client.release());
      }
    },
    POOL_CONNECTION_TIMEOUT_MS + 10_000,
  );
});

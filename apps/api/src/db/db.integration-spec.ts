import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import type { Pool } from 'pg';
import { createTestApp } from '../test-support/create-test-app';
import { PG_POOL } from './db.constants';
import { STATEMENT_TIMEOUT_MS } from './db.module';

describe('DbModule', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  // M5: with no timeout, one runaway query could hold one of the pool's
  // connections — shared by every member's requests — for as long as it ran.
  it("caps every statement on the app's connections with a server-side timeout", async () => {
    const { rows } = await app
      .get<Pool>(PG_POOL)
      .query<{ statement_timeout: string }>('show statement_timeout');
    expect(rows[0].statement_timeout).toBe(`${STATEMENT_TIMEOUT_MS / 1000}s`);
  });
});

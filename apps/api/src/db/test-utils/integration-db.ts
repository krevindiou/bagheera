import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schema';

// Shared helper for `*.integration-spec.ts` tests. `pnpm test:integration`
// provisions Postgres/Valkey via Testcontainers (see
// `test/integration-global-setup.ts`) and sets DATABASE_URL/VALKEY_URL
// before any spec file runs; a manually started `docker compose` Postgres
// also works for local one-off runs since this helper only reads env vars.
export interface IntegrationDb {
  db: NodePgDatabase<typeof schema>;
  pool: Pool;
}

export function connectIntegrationDb(): IntegrationDb {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set — run against the compose Postgres (see docker-compose.yml) to execute integration tests.',
    );
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

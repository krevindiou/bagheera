import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schema';

// Shared helper for `*.integration-spec.ts` tests, which run against the
// docker-compose Postgres instance (see `pnpm test:integration`). Not part
// of the unit CI stage — a real-Postgres CI stage lands later.
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

import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../schema';

// For `*.integration-spec.ts`: `pnpm test:integration` provisions Postgres
// via Testcontainers and sets DATABASE_URL first (see
// test/integration-global-setup.ts).
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

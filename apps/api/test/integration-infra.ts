import path from 'node:path';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { seedDatabase } from '../src/db/seed';

// Started once for the whole `pnpm test:integration` run (Jest globalSetup
// keeps this module instance alive between setup and teardown), giving the
// integration suite real Postgres/Valkey instances instead of a
// developer-started `docker compose` pair.
const POSTGRES_IMAGE = 'postgres:18-alpine';
const VALKEY_IMAGE = 'valkey/valkey:9-alpine';
const POSTGRES_USER = 'bagheera';
const POSTGRES_PASSWORD = 'bagheera';
const POSTGRES_DB = 'bagheera';

let postgresContainer: StartedTestContainer | undefined;
let valkeyContainer: StartedTestContainer | undefined;

export async function startIntegrationInfra(): Promise<void> {
  postgresContainer = await new GenericContainer(POSTGRES_IMAGE)
    .withEnvironment({
      POSTGRES_USER,
      POSTGRES_PASSWORD,
      POSTGRES_DB,
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();

  valkeyContainer = await new GenericContainer(VALKEY_IMAGE)
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
    .start();

  const databaseUrl = `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${postgresContainer.getHost()}:${postgresContainer.getMappedPort(5432)}/${POSTGRES_DB}`;
  const valkeyUrl = `redis://${valkeyContainer.getHost()}:${valkeyContainer.getMappedPort(6379)}`;

  process.env.DATABASE_URL = databaseUrl;
  process.env.VALKEY_URL = valkeyUrl;
  // Every createTestApp() boots a real Nest app with the real pino logger
  // (logging.module.ts defaults to 'info', logging a JSON line per HTTP
  // request) — across the whole suite that's hundreds of lines of noise
  // burying the actual jest output. Quiet by default; still overridable by
  // setting LOG_LEVEL before running the suite, for anyone who actually
  // wants request-level logs while debugging one.
  if (!process.env.LOG_LEVEL) {
    process.env.LOG_LEVEL = 'silent';
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  await migrate(db, {
    migrationsFolder: path.join(__dirname, '..', 'drizzle'),
  });
  await seedDatabase(db);
  await pool.end();
}

export async function stopIntegrationInfra(): Promise<void> {
  await postgresContainer?.stop();
  await valkeyContainer?.stop();
  postgresContainer = undefined;
  valkeyContainer = undefined;
}

import { Global, Inject, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DRIZZLE, PG_POOL } from './db.constants';
import * as schema from './schema';

const logger = new Logger('DbModule');

// Server-side cap on any one statement from the app, so a runaway query
// can't hold one of the pool's few connections — which every member's
// requests share — indefinitely. Migrations and the seed script connect on
// their own, without it.
export const STATEMENT_TIMEOUT_MS = 10_000;

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Pool => {
        const pool = new Pool({
          connectionString: config.getOrThrow<string>('DATABASE_URL'),
          statement_timeout: STATEMENT_TIMEOUT_MS,
        });
        // Idle-client errors (e.g. DB restart) are otherwise unhandled and
        // crash the process; log and let the pool recycle the connection.
        pool.on('error', (err) => logger.error('Idle Postgres client error', err));
        return pool;
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool): NodePgDatabase<typeof schema> => drizzle(pool, { schema }),
    },
  ],
  exports: [DRIZZLE],
})
export class DbModule implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    // app.close() doesn't end a raw pg Pool on its own: in production that
    // leaks connections, in the integration suite they pile up until
    // Testcontainers kills Postgres under them.
    if (!this.pool.ended) {
      await this.pool.end();
    }
  }
}

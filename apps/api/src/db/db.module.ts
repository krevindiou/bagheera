import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DRIZZLE, PG_POOL } from './db.constants';
import * as schema from './schema';

const logger = new Logger('DbModule');

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
        });
        // Idle-client errors (e.g. DB restart) are otherwise unhandled and
        // crash the process; log and let the pool recycle the connection.
        pool.on('error', (err) =>
          logger.error('Idle Postgres client error', err),
        );
        return pool;
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool): NodePgDatabase<typeof schema> =>
        drizzle(pool, { schema }),
    },
  ],
  exports: [DRIZZLE],
})
export class DbModule {}

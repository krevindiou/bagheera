import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { BULLMQ_CONNECTION, WORKER_BULLMQ_CONNECTION } from './email.constants';

/**
 * BullMQ requires its own ioredis connection (the session/rate-limit
 * modules use the `redis` package client instead) and, for Workers
 * specifically, `maxRetriesPerRequest: null` — see BullMQ's connection
 * docs. The Queue and the Worker get separate connections: a Worker holds
 * its connection open on a blocking command between jobs, which would
 * otherwise stall every `queue.add()` behind that block.
 */
export const bullmqConnectionProvider: Provider = {
  provide: BULLMQ_CONNECTION,
  inject: [ConfigService],
  useFactory: (config: ConfigService): IORedis =>
    new IORedis(config.getOrThrow<string>('VALKEY_URL'), {
      maxRetriesPerRequest: null,
    }),
};

export const workerBullmqConnectionProvider: Provider = {
  provide: WORKER_BULLMQ_CONNECTION,
  inject: [ConfigService],
  useFactory: (config: ConfigService): IORedis =>
    new IORedis(config.getOrThrow<string>('VALKEY_URL'), {
      maxRetriesPerRequest: null,
    }),
};

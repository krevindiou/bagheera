import { ConfigService } from '@nestjs/config';
import type IORedis from 'ioredis';
import { createValkeyClient } from './valkey-client';

/**
 * A Valkey connection for BullMQ, with `maxRetriesPerRequest: null` as
 * BullMQ requires for Workers.
 */
export function createBullmqConnection(config: ConfigService): IORedis {
  return createValkeyClient(config, undefined, { maxRetriesPerRequest: null });
}

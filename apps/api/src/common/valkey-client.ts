import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis, { type RedisOptions } from 'ioredis';

/**
 * The one Valkey client library (ioredis — BullMQ requires it, and
 * connect-redis / rate-limiter-flexible accept it). The password comes from
 * VALKEY_PASSWORD: production keeps it out of VALKEY_URL (see
 * .kamal/secrets), and a URL-only connection there is refused with NOAUTH.
 * `options` overrides per consumer, e.g. BullMQ Workers need
 * `maxRetriesPerRequest: null`.
 */
export function createValkeyClient(
  config: ConfigService,
  logger?: Logger,
  options: RedisOptions = {},
): IORedis {
  const client = new IORedis(config.getOrThrow<string>('VALKEY_URL'), {
    password: config.get<string>('VALKEY_PASSWORD'),
    ...options,
  });
  if (logger) client.on('error', (err) => logger.error('Valkey client error', err));
  return client;
}

/** Closes a client once — a no-op if it is already closed. */
export async function closeValkeyClient(client: IORedis): Promise<void> {
  if (client.status !== 'end') {
    await client.quit();
  }
}

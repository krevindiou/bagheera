import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

export async function createValkeyClient(
  config: ConfigService,
  logger: Logger,
): Promise<RedisClientType> {
  const client: RedisClientType = createClient({
    url: config.getOrThrow<string>('VALKEY_URL'),
    password: config.get<string>('VALKEY_PASSWORD'),
  });
  client.on('error', (err) => logger.error('Valkey client error', err));
  await client.connect();
  return client;
}

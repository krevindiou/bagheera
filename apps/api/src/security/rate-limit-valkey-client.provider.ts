import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

export const RATE_LIMIT_VALKEY_CLIENT = Symbol('RATE_LIMIT_VALKEY_CLIENT');

const logger = new Logger('RateLimitGuard');

export const rateLimitValkeyClientProvider: Provider = {
  provide: RATE_LIMIT_VALKEY_CLIENT,
  inject: [ConfigService],
  useFactory: async (config: ConfigService): Promise<RedisClientType> => {
    const client: RedisClientType = createClient({
      url: config.getOrThrow<string>('VALKEY_URL'),
      password: config.get<string>('VALKEY_PASSWORD'),
    });
    client.on('error', (err) => logger.error('Valkey client error', err));
    await client.connect();
    return client;
  },
};

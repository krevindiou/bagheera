import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { VALKEY_CLIENT } from './session.constants';

const logger = new Logger('SessionModule');

export const valkeyClientProvider: Provider = {
  provide: VALKEY_CLIENT,
  inject: [ConfigService],
  useFactory: async (config: ConfigService): Promise<RedisClientType> => {
    const client: RedisClientType = createClient({
      url: config.getOrThrow<string>('VALKEY_URL'),
    });
    client.on('error', (err) => logger.error('Valkey client error', err));
    await client.connect();
    return client;
  },
};

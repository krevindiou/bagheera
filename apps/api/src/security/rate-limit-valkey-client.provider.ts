import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createValkeyClient } from '../common/valkey-client';

export const RATE_LIMIT_VALKEY_CLIENT = Symbol('RATE_LIMIT_VALKEY_CLIENT');

const logger = new Logger('RateLimitGuard');

export const rateLimitValkeyClientProvider: Provider = {
  provide: RATE_LIMIT_VALKEY_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => createValkeyClient(config, logger),
};

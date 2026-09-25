import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createValkeyClient } from '../common/valkey-client';
import { VALKEY_CLIENT } from './session.constants';

const logger = new Logger('SessionModule');

export const valkeyClientProvider: Provider = {
  provide: VALKEY_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => createValkeyClient(config, logger),
};

import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createBullmqConnection } from '../common/bullmq-connection';
import { BULLMQ_CONNECTION, WORKER_BULLMQ_CONNECTION } from './email.constants';

/**
 * The Queue and the Worker get separate connections: a Worker holds its
 * connection open on a blocking command between jobs, which would
 * otherwise stall every `queue.add()` behind that block.
 */
export const bullmqConnectionProvider: Provider = {
  provide: BULLMQ_CONNECTION,
  inject: [ConfigService],
  useFactory: createBullmqConnection,
};

export const workerBullmqConnectionProvider: Provider = {
  provide: WORKER_BULLMQ_CONNECTION,
  inject: [ConfigService],
  useFactory: createBullmqConnection,
};

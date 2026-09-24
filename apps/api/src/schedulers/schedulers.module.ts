import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { createBullmqConnection } from '../common/bullmq-connection';
import { OperationsModule } from '../operations/operations.module';
import { SchedulerBatchController } from './batch.controller';
import { SchedulerBatchService } from './batch.service';
import {
  GENERATION_QUEUE,
  GENERATION_QUEUE_CONNECTION,
  GENERATION_QUEUE_NAME,
  GENERATION_WORKER,
  GENERATION_WORKER_CONNECTION,
  GenerationQueueService,
} from './generation-queue.service';
import { SchedulerGenerationService } from './generation.service';
import { createGenerationWorker } from './generation.worker';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [OperationsModule],
  controllers: [SchedulerController, SchedulerBatchController],
  providers: [
    SchedulerService,
    SchedulerGenerationService,
    SchedulerBatchService,
    // The Queue and the Worker each get their own connection — see
    // email/bullmq-connection.provider.ts for why.
    {
      provide: GENERATION_QUEUE_CONNECTION,
      inject: [ConfigService],
      useFactory: createBullmqConnection,
    },
    {
      provide: GENERATION_WORKER_CONNECTION,
      inject: [ConfigService],
      useFactory: createBullmqConnection,
    },
    {
      provide: GENERATION_QUEUE,
      inject: [GENERATION_QUEUE_CONNECTION],
      useFactory: (connection: IORedis): Queue => new Queue(GENERATION_QUEUE_NAME, { connection }),
    },
    {
      provide: GENERATION_WORKER,
      inject: [GENERATION_WORKER_CONNECTION, SchedulerGenerationService],
      useFactory: createGenerationWorker,
    },
    GenerationQueueService,
  ],
  exports: [SchedulerService, SchedulerGenerationService, GenerationQueueService],
})
export class SchedulersModule implements OnModuleDestroy {
  constructor(
    @Inject(GENERATION_WORKER) private readonly worker: Worker,
    @Inject(GENERATION_WORKER_CONNECTION) private readonly workerConnection: IORedis,
    @Inject(GENERATION_QUEUE) private readonly queue: Queue,
    @Inject(GENERATION_QUEUE_CONNECTION) private readonly queueConnection: IORedis,
  ) {}

  // Explicit order, as in EmailModule: the worker stops pulling jobs and
  // closes its blocking connection before the connection it borrows goes.
  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    this.workerConnection.disconnect();
    await this.queue.close();
    await this.queueConnection.quit();
  }
}

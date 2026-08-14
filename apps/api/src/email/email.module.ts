import {
  Global,
  Inject,
  Module,
  OnModuleDestroy,
  Provider,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import {
  bullmqConnectionProvider,
  workerBullmqConnectionProvider,
} from './bullmq-connection.provider';
import {
  BULLMQ_CONNECTION,
  EMAIL_PROVIDER,
  EMAIL_QUEUE,
  EMAIL_QUEUE_NAME,
} from './email.constants';
import { EmailQueueService } from './email-queue.service';
import { EmailWorker } from './email.worker';
import { SmtpEmailProvider } from './smtp-email.provider';

const emailQueueProvider: Provider = {
  provide: EMAIL_QUEUE,
  inject: [BULLMQ_CONNECTION],
  useFactory: (connection: IORedis): Queue =>
    new Queue(EMAIL_QUEUE_NAME, { connection }),
};

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    bullmqConnectionProvider,
    workerBullmqConnectionProvider,
    emailQueueProvider,
    { provide: EMAIL_PROVIDER, useClass: SmtpEmailProvider },
    EmailQueueService,
    EmailWorker,
  ],
  exports: [EmailQueueService, EMAIL_PROVIDER],
})
export class EmailModule implements OnModuleDestroy {
  constructor(
    @Inject(BULLMQ_CONNECTION) private readonly connection: IORedis,
    @Inject(EMAIL_QUEUE) private readonly queue: Queue,
    private readonly worker: EmailWorker,
  ) {}

  // Explicit order: the worker must stop pulling jobs and close its
  // internal blocking connection before the shared connection it borrows
  // is closed, or ioredis leaves a dangling handle (and Jest complains).
  async onModuleDestroy(): Promise<void> {
    await this.worker.onModuleDestroy();
    await this.queue.close();
    await this.connection.quit();
  }
}

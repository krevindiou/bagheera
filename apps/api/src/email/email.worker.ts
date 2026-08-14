import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import IORedis from 'ioredis';
import { Job, Worker } from 'bullmq';
import {
  EMAIL_PROVIDER,
  EMAIL_QUEUE_NAME,
  WORKER_BULLMQ_CONNECTION,
} from './email.constants';
import { EmailMessage, type EmailProvider } from './email-message';

/** Consumes jobs enqueued by `EmailQueueService` and hands them to the configured `EmailProvider`. */
@Injectable()
export class EmailWorker implements OnModuleDestroy {
  private readonly logger = new Logger('EmailWorker');
  private readonly worker: Worker<EmailMessage>;

  constructor(
    @Inject(WORKER_BULLMQ_CONNECTION) private readonly connection: IORedis,
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
  ) {
    this.worker = new Worker<EmailMessage>(
      EMAIL_QUEUE_NAME,
      async (job: Job<EmailMessage>) => {
        await this.provider.send(job.data);
      },
      { connection: this.connection },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`Email job ${job?.id} failed: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    this.connection.disconnect();
  }
}

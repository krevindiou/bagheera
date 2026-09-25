import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import IORedis from 'ioredis';
import { Job, Worker } from 'bullmq';
import { reportFinalJobFailure } from '../common/report-job-failure';
import { SignupRequestService } from '../members/signup-request.service';
import {
  EMAIL_PROVIDER,
  EMAIL_QUEUE_NAME,
  SIGNUP_REQUEST_JOB,
  WORKER_BULLMQ_CONNECTION,
} from './email.constants';
import { EmailMessage, type EmailProvider, SignupRequest } from './email-message';

/**
 * Consumes jobs enqueued by `EmailQueueService`: hands a ready message to
 * the configured `EmailProvider`, and a sign-up request to
 * `SignupRequestService`, which queues the one message it resolves to.
 */
@Injectable()
export class EmailWorker implements OnModuleDestroy {
  private readonly logger = new Logger('EmailWorker');
  private readonly worker: Worker<EmailMessage | SignupRequest>;

  constructor(
    @Inject(WORKER_BULLMQ_CONNECTION) private readonly connection: IORedis,
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
    private readonly signupRequests: SignupRequestService,
  ) {
    this.worker = new Worker<EmailMessage | SignupRequest>(
      EMAIL_QUEUE_NAME,
      (job: Job<EmailMessage | SignupRequest>) => this.process(job),
      { connection: this.connection },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`Email job ${job?.id} failed: ${err.message}`);
      reportFinalJobFailure(job, err);
    });
  }

  private async process(job: Job<EmailMessage | SignupRequest>): Promise<void> {
    if (job.name === SIGNUP_REQUEST_JOB) {
      await this.signupRequests.handle(job.data as SignupRequest);
      return;
    }
    await this.provider.send(job.data as EmailMessage);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    this.connection.disconnect();
  }
}

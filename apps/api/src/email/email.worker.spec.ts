import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type IORedis from 'ioredis';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { reportFinalJobFailure } from '../common/report-job-failure';
import type { SignupRequestService } from '../members/signup-request.service';
import type { EmailMessage, SignupRequest } from './email-message';
import { EmailWorker } from './email.worker';
import { metrics } from '../logging/metrics';
import { vi } from 'vitest';

// Capture the processor the Worker is handed and drive it directly.
// (`mock` prefix: vi.mock's hoisted factory may reference it.)
type Processor = (job: Job<EmailMessage | SignupRequest>) => Promise<void>;
const mockWorker = { on: vi.fn(), close: vi.fn().mockResolvedValue(undefined) };
let mockProcessor: Processor | undefined;
vi.mock('../common/report-job-failure', async (importActual) => ({
  ...(await importActual<typeof import('../common/report-job-failure')>()),
  reportFinalJobFailure: vi.fn(),
}));
vi.mock('../logging/metrics', () => ({ metrics: { emailJob: vi.fn() } }));
vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(function Worker(_queue: string, processor: Processor) {
    mockProcessor = processor;
    return mockWorker;
  }),
  // Read by EmailQueueService's decorator metadata when it loads
  // transitively; vi.mock rejects exports the factory doesn't provide.
  Queue: class Queue {},
}));

function job(name: string, data: EmailMessage | SignupRequest): Job<EmailMessage | SignupRequest> {
  return { id: 'job-1', name, data } as Job<EmailMessage | SignupRequest>;
}

function listener(event: string): (job: Job, err?: Error) => void {
  const call = mockWorker.on.mock.calls.find(([name]) => name === event) as
    | [string, (job: Job, err?: Error) => void]
    | undefined;
  if (!call) {
    throw new Error(`No '${event}' listener`);
  }
  return call[1];
}

function settledJob(attemptsMade: number): Job {
  return { id: '42', name: 'send', attemptsMade, opts: { attempts: 3 } } as Job;
}

describe('EmailWorker', () => {
  const provider = { send: vi.fn().mockResolvedValue(undefined) };
  const signupRequests = { handle: vi.fn().mockResolvedValue(undefined) };
  const connection = { disconnect: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    new EmailWorker(
      connection as unknown as IORedis,
      provider,
      signupRequests as unknown as SignupRequestService,
    );
  });

  it('sends a ready message through the provider', async () => {
    const message: EmailMessage = { to: 'member@example.test', subject: 'S', html: '<p>B</p>' };

    await mockProcessor!(job('send', message));

    expect(provider.send).toHaveBeenCalledWith(message);
    expect(signupRequests.handle).not.toHaveBeenCalled();
  });

  // So BullMQ retries the job, and alerts once the last attempt fails.
  it("fails the job when the provider can't send", async () => {
    const message: EmailMessage = { to: 'member@example.test', subject: 'S', html: '<p>B</p>' };
    provider.send.mockRejectedValueOnce(new Error('SMTP send failed: ECONNECTION'));

    await expect(mockProcessor!(job('send', message))).rejects.toThrow(
      'SMTP send failed: ECONNECTION',
    );
  });

  it('hands a sign-up request to SignupRequestService, sending nothing itself', async () => {
    const request: SignupRequest = {
      email: 'new@example.test',
      country: 'FR',
      locale: 'en',
      sourceAddress: '203.0.113.7',
    };

    await mockProcessor!(job('signup-request', request));

    expect(signupRequests.handle).toHaveBeenCalledWith(request);
    expect(provider.send).not.toHaveBeenCalled();
  });

  it('fails a sign-up request with an error free of the failed query values', async () => {
    signupRequests.handle.mockRejectedValueOnce(
      new DrizzleQueryError(
        'insert into "member" ("email") values ($1)',
        ['marker@example.test'],
        undefined,
      ),
    );

    const thrown = await mockProcessor!(
      job('signup-request', {
        email: 'marker@example.test',
        country: 'FR',
        locale: 'en',
        sourceAddress: '198.51.100.7',
      }),
    ).catch((e: Error) => e);

    expect(thrown).toMatchObject({ message: 'query failed' });
    expect((thrown as Error).stack).not.toContain('marker@example.test');
  });

  it('logs a job that failed', () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const failed = settledJob(1);
    listener('failed')(failed, new Error('SMTP down'));

    expect(reportFinalJobFailure).toHaveBeenCalledWith(failed, expect.any(Error));
    expect(error).toHaveBeenCalledWith('Email job 42 failed: SMTP down');
    error.mockRestore();
  });

  it('counts a sent job, a retried attempt and a lost job', () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    listener('completed')(settledJob(1));
    listener('failed')(settledJob(1), new Error('SMTP down'));
    listener('failed')(settledJob(3), new Error('SMTP down'));

    expect(vi.mocked(metrics.emailJob).mock.calls).toEqual([
      ['send', 'sent'],
      ['send', 'retrying'],
      ['send', 'failed'],
    ]);
    error.mockRestore();
  });

  // BullMQ can report a failure it has no job for.
  it('logs, but cannot count, a failure without a job', () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    listener('failed')(undefined as unknown as Job, new Error('stalled'));

    expect(error).toHaveBeenCalledWith('Email job undefined failed: stalled');
    expect(metrics.emailJob).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('closes the worker before dropping its connection', async () => {
    const worker = new EmailWorker(
      connection as unknown as IORedis,
      provider,
      signupRequests as unknown as SignupRequestService,
    );

    await worker.onModuleDestroy();

    expect(mockWorker.close.mock.invocationCallOrder[0]).toBeLessThan(
      connection.disconnect.mock.invocationCallOrder[0],
    );
  });
});

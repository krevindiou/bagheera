import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import type IORedis from 'ioredis';
import { reportFinalJobFailure } from '../common/report-job-failure';
import type { SignupRequestService } from '../members/signup-request.service';
import type { EmailMessage, SignupRequest } from './email-message';
import { EmailWorker } from './email.worker';

// The real Worker would connect to Valkey and start polling — capture the
// processor it's handed instead, and drive it directly. (Prefixed `mock` so
// jest.mock's hoisted factory may reference it.)
type Processor = (job: Job<EmailMessage | SignupRequest>) => Promise<void>;
const mockWorker = { on: jest.fn(), close: jest.fn().mockResolvedValue(undefined) };
let mockProcessor: Processor | undefined;
jest.mock('../common/report-job-failure', () => ({ reportFinalJobFailure: jest.fn() }));
jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation((_queue: string, processor: Processor) => {
    mockProcessor = processor;
    return mockWorker;
  }),
}));

function job(name: string, data: EmailMessage | SignupRequest): Job<EmailMessage | SignupRequest> {
  return { name, data } as Job<EmailMessage | SignupRequest>;
}

describe('EmailWorker', () => {
  const provider = { send: jest.fn().mockResolvedValue(undefined) };
  const signupRequests = { handle: jest.fn().mockResolvedValue(undefined) };
  const connection = { disconnect: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
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

  it('logs a job that failed', () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const [event, listener] = mockWorker.on.mock.calls[0] as [
      string,
      (job: { id: string }, err: Error) => void,
    ];

    const failed = { id: '42' };
    listener(failed, new Error('SMTP down'));

    expect(event).toBe('failed');
    expect(reportFinalJobFailure).toHaveBeenCalledWith(failed, expect.any(Error));
    expect(error).toHaveBeenCalledWith('Email job 42 failed: SMTP down');
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

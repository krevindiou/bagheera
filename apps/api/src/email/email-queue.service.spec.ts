import type { Queue } from 'bullmq';
import type { EmailMessage, SignupRequest } from './email-message';
import { EmailQueueService } from './email-queue.service';

const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: true,
  removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
};

function serviceWith(add: jest.Mock): EmailQueueService {
  return new EmailQueueService({ add } as unknown as Queue<EmailMessage | SignupRequest>);
}

describe('EmailQueueService', () => {
  it('queues the message with retries, and never keeps a finished job for good', async () => {
    const add = jest.fn().mockResolvedValue(undefined);
    const message: EmailMessage = {
      to: 'member@example.test',
      subject: 'Subject',
      html: '<p>Body</p>',
    };

    await serviceWith(add).enqueue(message);

    expect(add).toHaveBeenCalledWith('send', message, JOB_OPTIONS);
  });

  it('queues a sign-up request as its own job, for the worker to resolve', async () => {
    const add = jest.fn().mockResolvedValue(undefined);
    const request: SignupRequest = {
      email: 'new@example.test',
      country: 'FR',
      locale: 'fr',
      sourceAddress: '203.0.113.7',
    };

    await serviceWith(add).enqueueSignupRequest(request);

    expect(add).toHaveBeenCalledWith('signup-request', request, JOB_OPTIONS);
  });
});

import type { Queue } from 'bullmq';
import type { EmailMessage } from './email-message';
import { EmailQueueService } from './email-queue.service';

describe('EmailQueueService', () => {
  it('queues the message with retries, and never keeps a finished job for good', async () => {
    const add = jest.fn().mockResolvedValue(undefined);
    const service = new EmailQueueService({ add } as unknown as Queue<EmailMessage>);
    const message: EmailMessage = {
      to: 'member@example.test',
      subject: 'Subject',
      html: '<p>Body</p>',
    };

    await service.enqueue(message);

    expect(add).toHaveBeenCalledWith('send', message, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
    });
  });
});

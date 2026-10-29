import type { Logger } from '@nestjs/common';
import { vi } from 'vitest';
import { Sentry } from '../logging/sentry';
import type { EmailMessage } from './email-message';
import { enqueueAlert } from './enqueue-alert';

vi.mock('../logging/sentry', () => ({ Sentry: { captureException: vi.fn() } }));

const message: EmailMessage = {
  to: 'member@example.test',
  subject: 'Subject',
  html: '<p>Body</p>',
};

describe('enqueueAlert', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queues the message', async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const logger = { error: vi.fn() };

    await enqueueAlert({ enqueue }, logger as unknown as Logger, message);

    expect(enqueue).toHaveBeenCalledWith(message);
    expect(logger.error).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('swallows a queue failure, logging and reporting it without the recipient', async () => {
    const outage = new Error('Connection is closed.');
    const enqueue = vi.fn().mockRejectedValue(outage);
    const logger = { error: vi.fn() };

    await expect(
      enqueueAlert({ enqueue }, logger as unknown as Logger, message),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith('Alert email not queued: Connection is closed.');
    expect(Sentry.captureException).toHaveBeenCalledWith(outage, {
      extra: { subject: 'Subject' },
    });
  });

  it('logs a non-Error rejection as unknown', async () => {
    const enqueue = vi.fn().mockRejectedValue('boom');
    const logger = { error: vi.fn() };

    await enqueueAlert({ enqueue }, logger as unknown as Logger, message);

    expect(logger.error).toHaveBeenCalledWith('Alert email not queued: unknown');
  });
});

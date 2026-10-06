import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';
import { SmtpEmailProvider } from './smtp-email.provider';

const mockSendMail = vi.fn();
vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
}));

const message = { to: 'member@example.test', subject: 'Hello', html: '<p>hi</p>' };

function provider(): SmtpEmailProvider {
  const config = { getOrThrow: (key: string) => `value-of-${key}` } as unknown as ConfigService;
  return new SmtpEmailProvider(config);
}

describe('SmtpEmailProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the message from the configured sender', async () => {
    mockSendMail.mockResolvedValue(undefined);
    await provider().send(message, 'job-1');
    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'value-of-EMAIL_FROM',
      to: message.to,
      subject: message.subject,
      html: message.html,
    });
  });

  it('logs a failure by job id and error code, without the recipient or the server message', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    mockSendMail.mockRejectedValue(
      Object.assign(new Error('550 <member@example.test>: Recipient rejected'), {
        code: 'EENVELOPE',
      }),
    );

    await expect(provider().send(message, 'job-42')).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('Failed to send email job job-42: EENVELOPE');
    expect(JSON.stringify(error.mock.calls)).not.toContain('member@example.test');
    error.mockRestore();
  });

  it('copes with an error without a code and a call without a job id', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    mockSendMail.mockRejectedValue(new Error('boom'));

    await provider().send(message);

    expect(error).toHaveBeenCalledWith('Failed to send email job unknown: unknown');
    error.mockRestore();
  });
});

import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';
import * as nodemailer from 'nodemailer';
import { SmtpEmailProvider, smtpTransportOptions } from './smtp-email.provider';

const mockSendMail = vi.fn();
vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
}));

const message = { to: 'member@example.test', subject: 'Hello', html: '<p>hi</p>' };

function provider(): SmtpEmailProvider {
  const config = { getOrThrow: (key: string) => `value-of-${key}` } as unknown as ConfigService;
  return new SmtpEmailProvider(config);
}

describe('smtpTransportOptions', () => {
  it('requires TLS on a plain smtp:// URL in production', () => {
    expect(smtpTransportOptions('smtp://mail.example.com:587', true)).toEqual({
      url: 'smtp://mail.example.com:587',
      requireTLS: true,
    });
    expect(smtpTransportOptions('SMTP://mail.example.com:587', true)).toMatchObject({
      requireTLS: true,
    });
  });

  it('leaves smtps:// alone in production — it is already TLS from the first byte', () => {
    expect(smtpTransportOptions('smtps://mail.example.com:465', true)).toEqual({
      url: 'smtps://mail.example.com:465',
    });
  });

  it('does not require TLS outside production, where the dev mail catcher has none', () => {
    expect(smtpTransportOptions('smtp://localhost:1025', false)).toEqual({
      url: 'smtp://localhost:1025',
    });
  });
});

describe('SmtpEmailProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds its transport from the configured URL, requiring TLS only in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    provider();
    expect(nodemailer.createTransport).toHaveBeenLastCalledWith({ url: 'value-of-EMAIL_SMTP_URL' });

    const config = {
      getOrThrow: (key: string) => (key === 'EMAIL_SMTP_URL' ? 'smtp://m:587' : 'x'),
    };
    new SmtpEmailProvider(config as unknown as ConfigService);
    expect(nodemailer.createTransport).toHaveBeenLastCalledWith({
      url: 'smtp://m:587',
      requireTLS: true,
    });

    vi.stubEnv('NODE_ENV', 'test');
    new SmtpEmailProvider(config as unknown as ConfigService);
    expect(nodemailer.createTransport).toHaveBeenLastCalledWith({ url: 'smtp://m:587' });
    vi.unstubAllEnvs();
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

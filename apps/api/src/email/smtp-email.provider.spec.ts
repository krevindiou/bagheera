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
    await provider().send(message);
    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'value-of-EMAIL_FROM',
      to: message.to,
      subject: message.subject,
      html: message.html,
    });
  });

  // Rejecting is what lets the queue retry the send and alert on the last
  // attempt; the error keeps only the code, since SMTP servers echo the
  // recipient in their messages.
  it('rejects a failed send with only its error code, not the recipient or the server message', async () => {
    mockSendMail.mockRejectedValue(
      Object.assign(new Error('550 <member@example.test>: Recipient rejected'), {
        code: 'EENVELOPE',
      }),
    );

    const failure = await provider()
      .send(message)
      .then(
        () => undefined,
        (err: unknown) => err,
      );

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe('SMTP send failed: EENVELOPE');
    expect(JSON.stringify(failure, Object.getOwnPropertyNames(failure))).not.toContain(
      'member@example.test',
    );
  });

  it('rejects an error without a code as an unknown failure', async () => {
    mockSendMail.mockRejectedValue(new Error('boom'));

    await expect(provider().send(message)).rejects.toThrow('SMTP send failed: unknown');
  });
});

import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { EmailQueueService } from '../email/email-queue.service';
import type { EmailMessage, SignupRequest } from '../email/email-message';
import fr from '../email/i18n/fr';
import type { AuditService } from '../security/audit.service';
import { FakeValkey } from '../test-support/fake-valkey';
import { testCryptoService } from '../test-support/test-crypto-service';
import { SIGNUP_MAIL_COOLDOWN_MS, SignupMailThrottle } from './signup-mail-throttle';
import { SignupRequestService } from './signup-request.service';
import { parseSignupToken } from './signup-token';
import { vi } from 'vitest';

const REQUEST: SignupRequest = {
  email: 'someone@example.test',
  country: 'FR',
  locale: 'fr',
  sourceAddress: '203.0.113.7',
};

function setup(existingRows: unknown[]) {
  const db = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(existingRows),
      }),
    }),
  } as unknown as NodePgDatabase;
  const emailQueue = {
    enqueue: vi.fn<(message: EmailMessage) => Promise<void>>().mockResolvedValue(undefined),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const config = { getOrThrow: () => 'https://app.example' } as unknown as ConfigService;
  const crypto = testCryptoService();
  const handler = new SignupRequestService(
    db,
    crypto,
    emailQueue as unknown as EmailQueueService,
    config,
    audit as unknown as AuditService,
    new SignupMailThrottle(new FakeValkey().asClient()),
  );
  const sent = () => emailQueue.enqueue.mock.calls.map((call) => call[0]);
  return { handler, audit, sent, emailQueue, crypto };
}

const REGISTERED = [{ id: 'member-1', email: 'someone@example.test', locale: 'fr' }];

function signupKeyIn(message: EmailMessage): string {
  const [, key] = /activate\?key=([^"&<\s]+)/.exec(message.html) ?? [];
  return decodeURIComponent(key);
}

describe('SignupRequestService', () => {
  it('emails a new address its sign-up link and records signup_confirmation_issued', async () => {
    const { handler, audit, sent } = setup([]);

    await handler.handle(REQUEST);

    expect(sent()).toHaveLength(1);
    expect(sent()[0].to).toBe(REQUEST.email);
    expect(sent()[0].html).toContain('https://app.example/fr/activate?key=');
    expect(audit.record).toHaveBeenCalledWith(
      'signup_confirmation_issued',
      null,
      REQUEST.sourceAddress,
    );
  });

  it("tells a registered address it already has an account, in its member's language, with no sign-up link", async () => {
    const { handler, audit, sent } = setup([
      { id: 'member-1', email: 'Someone@Example.test', locale: 'fr' },
    ]);

    await handler.handle({ ...REQUEST, locale: 'en' });

    expect(sent()).toHaveLength(1);
    expect(sent()[0].to).toBe('Someone@Example.test');
    expect(sent()[0].subject).toBe(fr.accountExists.subject);
    expect(sent()[0].html).toContain('https://app.example/fr/sign-in');
    expect(sent()[0].html).not.toContain('activate?key=');
    expect(audit.record).not.toHaveBeenCalled();
  });

  describe('the per-address cooldown', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      ['a new address', []],
      ['a registered address', REGISTERED],
    ])('mails %s once, however often it is requested within the cooldown', async (_, rows) => {
      const { handler, sent } = setup(rows);

      await handler.handle(REQUEST);
      vi.advanceTimersByTime(SIGNUP_MAIL_COOLDOWN_MS - 1);
      await handler.handle(REQUEST);
      expect(sent()).toHaveLength(1);

      vi.advanceTimersByTime(1);
      await handler.handle(REQUEST);
      expect(sent()).toHaveLength(2);
    });

    it('leaves the link it sent valid for the whole time it holds back further ones', async () => {
      const { handler, sent, crypto } = setup([]);

      await handler.handle(REQUEST);
      vi.advanceTimersByTime(SIGNUP_MAIL_COOLDOWN_MS - 1);
      await handler.handle(REQUEST);

      expect(sent()).toHaveLength(1);
      expect(parseSignupToken(crypto, signupKeyIn(sent()[0]))).toMatchObject({
        email: REQUEST.email,
      });
    });

    it('does not start when queuing the email fails, so the retry still sends', async () => {
      const { handler, sent, emailQueue } = setup([]);
      emailQueue.enqueue.mockRejectedValueOnce(new Error('queue down'));

      await expect(handler.handle(REQUEST)).rejects.toThrow('queue down');
      await handler.handle(REQUEST);

      expect(emailQueue.enqueue).toHaveBeenCalledTimes(2);
      expect(sent()[1].to).toBe(REQUEST.email);
    });
  });
});

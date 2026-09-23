import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { EmailQueueService } from '../email/email-queue.service';
import type { EmailMessage, SignupRequest } from '../email/email-message';
import fr from '../email/i18n/fr';
import type { AuditService } from '../security/audit.service';
import { testCryptoService } from '../test-support/test-crypto-service';
import { SignupRequestService } from './signup-request.service';

const REQUEST: SignupRequest = {
  email: 'someone@example.test',
  country: 'FR',
  locale: 'fr',
  sourceAddress: '203.0.113.7',
};

function setup(existingRows: unknown[]) {
  const db = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(existingRows),
      }),
    }),
  } as unknown as NodePgDatabase;
  const emailQueue = {
    enqueue: jest.fn<Promise<void>, [EmailMessage]>().mockResolvedValue(undefined),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const config = { getOrThrow: () => 'https://app.example' } as unknown as ConfigService;
  const handler = new SignupRequestService(
    db,
    testCryptoService(),
    emailQueue as unknown as EmailQueueService,
    config,
    audit as unknown as AuditService,
  );
  const sent = () => emailQueue.enqueue.mock.calls.map((call) => call[0]);
  return { handler, audit, sent };
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
});

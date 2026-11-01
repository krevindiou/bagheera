import { Logger } from '@nestjs/common';
import { vi, type MockInstance } from 'vitest';
import { FakeValkey } from '../test-support/fake-valkey';
import {
  SIGNUP_MAIL_COOLDOWN_MS,
  SIGNUP_MAIL_DAILY_CAP,
  SignupMailThrottle,
} from './signup-mail-throttle';
import { SIGNUP_TOKEN_TTL_MS } from './signup-token';

const MINUTE = 60 * 1000;

function setup() {
  const throttle = new SignupMailThrottle(new FakeValkey().asClient());
  const send = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  return { throttle, send };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-06-15T10:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SignupMailThrottle', () => {
  it('never outlasts a sign-up link, so a skipped request still leaves a live one', () => {
    expect(SIGNUP_MAIL_COOLDOWN_MS).toBeLessThanOrEqual(SIGNUP_TOKEN_TTL_MS);
  });

  it('mails an address once per cooldown, however the requests are spread across it', async () => {
    const { throttle, send } = setup();

    await throttle.run('victim@example.test', send);
    for (let elapsed = MINUTE; elapsed < SIGNUP_MAIL_COOLDOWN_MS; elapsed += MINUTE) {
      vi.setSystemTime(new Date('2026-06-15T10:00:00Z').getTime() + elapsed);
      await throttle.run('victim@example.test', send);
    }
    expect(send).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-06-15T10:00:00Z').getTime() + SIGNUP_MAIL_COOLDOWN_MS);
    await throttle.run('victim@example.test', send);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('shares the cooldown across letter case and surrounding spaces', async () => {
    const { throttle, send } = setup();

    await throttle.run('Victim@Example.test', send);
    await throttle.run(' victim@example.TEST ', send);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('keeps each address on its own cooldown', async () => {
    const { throttle, send } = setup();

    await throttle.run('one@example.test', send);
    await throttle.run('two@example.test', send);

    expect(send).toHaveBeenCalledTimes(2);
  });

  it('gives the cooldown back when sending fails, so a retry still sends', async () => {
    const { throttle, send } = setup();
    send.mockRejectedValueOnce(new Error('queue down'));

    await expect(throttle.run('victim@example.test', send)).rejects.toThrow('queue down');
    await throttle.run('victim@example.test', send);

    expect(send).toHaveBeenCalledTimes(2);
  });

  describe('the daily cap', () => {
    let warn: MockInstance<Logger['warn']>;

    beforeEach(() => {
      warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
      warn.mockRestore();
    });

    async function spendDailyCap(throttle: SignupMailThrottle): Promise<void> {
      const send = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
      for (let i = 0; i < SIGNUP_MAIL_DAILY_CAP; i++) {
        await throttle.run(`member-${i}@example.test`, send);
      }
      expect(send).toHaveBeenCalledTimes(SIGNUP_MAIL_DAILY_CAP);
    }

    it('drops sign-up mail once spent', async () => {
      const { throttle, send } = setup();
      await spendDailyCap(throttle);

      await throttle.run('late@example.test', send);
      await throttle.run('later@example.test', send);

      expect(send).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('does not count a failed send', async () => {
      const { throttle, send } = setup();
      send.mockRejectedValueOnce(new Error('queue down'));
      await expect(throttle.run('failed@example.test', send)).rejects.toThrow();
      await spendDailyCap(throttle);

      expect(send).toHaveBeenCalledTimes(1);
    });

    it('starts afresh the next UTC day, without holding back an address it dropped', async () => {
      const { throttle, send } = setup();
      await spendDailyCap(throttle);
      vi.setSystemTime(new Date('2026-06-15T23:30:00Z'));
      await throttle.run('late@example.test', send);

      // Within the cooldown of the dropped request, which never sent.
      vi.setSystemTime(new Date('2026-06-16T00:00:00Z'));
      await throttle.run('late@example.test', send);

      expect(send).toHaveBeenCalledTimes(1);
    });
  });
});

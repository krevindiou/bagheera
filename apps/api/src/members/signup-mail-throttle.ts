import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import type IORedis from 'ioredis';
import { normalizeEmail } from '../common/email-address';
import { RATE_LIMIT_VALKEY_CLIENT } from '../security/rate-limit-valkey-client.provider';
import { SIGNUP_TOKEN_TTL_MS } from './signup-token';

/**
 * At most one sign-up email per address in this window. No longer than a
 * link lives, so a request skipped meanwhile still leaves a live link in
 * the mailbox.
 */
export const SIGNUP_MAIL_COOLDOWN_MS = SIGNUP_TOKEN_TTL_MS;

/** Sign-up emails sent across all addresses per UTC day. */
export const SIGNUP_MAIL_DAILY_CAP = 1000;

// Kept past the day it counts, so a late decrement never lands on a fresh key.
const DAILY_COUNT_TTL_SECONDS = 2 * 24 * 60 * 60;

/**
 * Bounds the mail anonymous sign-up requests can cause, which the per-request
 * budgets alone don't: a caller staying within them could still mail one
 * address every few seconds, forever. Enforced on the worker, after the
 * request has been answered, so it reveals nothing about the address, and a
 * request it drops is dropped silently.
 */
@Injectable()
export class SignupMailThrottle {
  private readonly logger = new Logger(SignupMailThrottle.name);

  constructor(@Inject(RATE_LIMIT_VALKEY_CLIENT) private readonly valkey: IORedis) {}

  /**
   * Runs `send` unless `email` was mailed within the cooldown or the day's
   * cap is spent. A failing `send` gives both back, so the job's retry can
   * still send.
   */
  async run(email: string, send: () => Promise<void>): Promise<void> {
    const cooldownKey = `rl:signup-mail:cooldown:${createHash('sha256')
      .update(normalizeEmail(email))
      .digest('base64url')}`;
    const claimed = await this.valkey.set(cooldownKey, '1', 'PX', SIGNUP_MAIL_COOLDOWN_MS, 'NX');
    if (claimed !== 'OK') {
      return;
    }

    // Keyed by date, so a counter that somehow misses its expiry is only
    // left behind, never stuck at the cap.
    const dailyKey = `rl:signup-mail:day:${new Date().toISOString().slice(0, 10)}`;
    const sentToday = await this.valkey.incr(dailyKey);
    if (sentToday === 1) {
      await this.valkey.expire(dailyKey, DAILY_COUNT_TTL_SECONDS);
    }
    if (sentToday > SIGNUP_MAIL_DAILY_CAP) {
      if (sentToday === SIGNUP_MAIL_DAILY_CAP + 1) {
        this.logger.warn(
          'Daily sign-up email cap reached; dropping sign-up requests until UTC midnight',
        );
      }
      await this.valkey.del(cooldownKey);
      return;
    }

    try {
      await send();
    } catch (err) {
      await Promise.allSettled([this.valkey.del(cooldownKey), this.valkey.decr(dailyKey)]);
      throw err;
    }
  }
}

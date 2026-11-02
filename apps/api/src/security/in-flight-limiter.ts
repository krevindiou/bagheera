import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type IORedis from 'ioredis';
import { RATE_LIMIT_VALKEY_CLIENT } from './rate-limit-valkey-client.provider';

// One sorted set per key: each member is a held slot, scored by when it
// lapses. Lapsed slots are dropped first, so a process that dies holding one
// only keeps it until then. Valkey's own clock, so API hosts can't disagree.
const ACQUIRE = `local t = redis.call('time')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
redis.call('zremrangebyscore', KEYS[1], '-inf', now)
if redis.call('zcard', KEYS[1]) >= tonumber(ARGV[1]) then
  return 0
end
redis.call('zadd', KEYS[1], now + tonumber(ARGV[2]), ARGV[3])
redis.call('pexpire', KEYS[1], ARGV[2])
return 1`;

export interface InFlightLimit {
  /** Slots one key can hold at once. */
  max: number;
  /** How long a slot outlives a holder that never released it. */
  slotTtlMs: number;
}

/**
 * Caps how many runs of some work one key (e.g. a member) has going at once,
 * across every API instance, through Valkey.
 */
@Injectable()
export class InFlightLimiter {
  private readonly logger = new Logger(InFlightLimiter.name);

  constructor(@Inject(RATE_LIMIT_VALKEY_CLIENT) private readonly valkey: IORedis) {}

  /** The token to release the slot with; null when every slot is taken. */
  async acquire(key: string, limit: InFlightLimit): Promise<string | null> {
    const token = randomUUID();
    const acquired = await this.valkey.eval(
      ACQUIRE,
      1,
      this.slotsKey(key),
      limit.max,
      limit.slotTtlMs,
      token,
    );
    return acquired === 1 ? token : null;
  }

  // Never throws: the work it follows already finished, and an unreleased
  // slot lapses on its own.
  async release(key: string, token: string): Promise<void> {
    try {
      await this.valkey.zrem(this.slotsKey(key), token);
    } catch (err) {
      this.logger.warn(`Could not release an in-flight slot: ${String(err)}`);
    }
  }

  /** Runs `work` in a slot of `key`, or throws `onBusy()` when none is free. */
  async run<T>(
    key: string,
    limit: InFlightLimit,
    onBusy: () => Error,
    work: () => Promise<T>,
  ): Promise<T> {
    const token = await this.acquire(key, limit);
    if (token === null) {
      throw onBusy();
    }
    try {
      return await work();
    } finally {
      await this.release(key, token);
    }
  }

  private slotsKey(key: string): string {
    return `rl:inflight:${key}`;
  }
}

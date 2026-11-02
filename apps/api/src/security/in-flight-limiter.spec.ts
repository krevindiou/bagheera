import { Logger } from '@nestjs/common';
import type IORedis from 'ioredis';
import { vi } from 'vitest';
import { InFlightLimiter } from './in-flight-limiter';

const limit = { max: 2, slotTtlMs: 60_000 };

function fakeValkey(acquired: 0 | 1, zrem: () => Promise<number> = () => Promise.resolve(1)) {
  return {
    eval: vi.fn().mockResolvedValue(acquired),
    zrem: vi.fn(zrem),
  };
}

function limiterOn(valkey: ReturnType<typeof fakeValkey>): InFlightLimiter {
  return new InFlightLimiter(valkey as unknown as IORedis);
}

describe('InFlightLimiter', () => {
  it('runs the work in a slot of the key, then releases that same slot', async () => {
    const valkey = fakeValkey(1);

    await expect(
      limiterOn(valkey).run(
        'dashboard:m1',
        limit,
        () => new Error('busy'),
        () => Promise.resolve('done'),
      ),
    ).resolves.toBe('done');

    const [, keyCount, key, max, ttl, token] = valkey.eval.mock.calls[0] as unknown[];
    expect([keyCount, key, max, ttl]).toEqual([1, 'rl:inflight:dashboard:m1', 2, 60_000]);
    expect(valkey.zrem).toHaveBeenCalledWith('rl:inflight:dashboard:m1', token);
  });

  it('releases the slot when the work fails, and rethrows', async () => {
    const valkey = fakeValkey(1);

    await expect(
      limiterOn(valkey).run(
        'k',
        limit,
        () => new Error('busy'),
        () => Promise.reject(new Error('work failed')),
      ),
    ).rejects.toThrow('work failed');
    expect(valkey.zrem).toHaveBeenCalledTimes(1);
  });

  it('throws onBusy() without running the work or releasing when no slot is free', async () => {
    const valkey = fakeValkey(0);
    const work = vi.fn();

    await expect(limiterOn(valkey).run('k', limit, () => new Error('busy'), work)).rejects.toThrow(
      'busy',
    );
    expect(work).not.toHaveBeenCalled();
    expect(valkey.zrem).not.toHaveBeenCalled();
  });

  it("keeps the work's result when releasing fails: the slot lapses on its own", async () => {
    const valkey = fakeValkey(1, () => Promise.reject(new Error('valkey down')));
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await expect(
      limiterOn(valkey).run(
        'k',
        limit,
        () => new Error('busy'),
        () => Promise.resolve(42),
      ),
    ).resolves.toBe(42);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('gives each acquired slot its own token', async () => {
    const valkey = fakeValkey(1);
    const limiter = limiterOn(valkey);

    const first = await limiter.acquire('k', limit);
    const second = await limiter.acquire('k', limit);

    expect(first).not.toBeNull();
    expect(second).not.toBe(first);
  });
});

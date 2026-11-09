import { vi, type Mock } from 'vitest';
/* oxlint-disable typescript/unbound-method -- vitest matchers on mocked client methods */
import { Reflector } from '@nestjs/core';
import type IORedis from 'ioredis';
import { RateLimitGuard } from './rate-limit.guard';
import { RATE_LIMIT_OPTIONS, RateLimitOptions } from './rate-limit.constants';
import { SKIP_RATE_LIMIT_KEY } from './skip-rate-limit.decorator';
import { fakeExecutionContext, fakeRequest } from '../test-support/fake-http-context';

// Shared by every RateLimiterRedis the guard creates. (`mock` prefix:
// vi.mock's hoisted factory may reference it; typed so `.mock.calls` isn't
// `any[][]`.)
const mockConsume = vi.fn<(key: string) => Promise<void>>();
vi.mock('rate-limiter-flexible', () => ({
  RateLimiterRedis: vi.fn().mockImplementation(function RateLimiterRedis() {
    return { consume: mockConsume };
  }),
}));
import { RateLimiterRedis } from 'rate-limiter-flexible';

function fakeValkeyClient(overrides: Partial<IORedis> = {}): IORedis {
  return {
    exists: vi.fn().mockResolvedValue(0),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    set: vi.fn().mockResolvedValue('OK'),
    status: 'ready',
    quit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as IORedis;
}

function fakeReflector(opts: { skip?: boolean; options?: RateLimitOptions } = {}): Reflector {
  return {
    get: vi.fn((key: string | symbol) => {
      if (key === SKIP_RATE_LIMIT_KEY) return opts.skip;
      if (key === RATE_LIMIT_OPTIONS) return opts.options;
      return undefined;
    }),
  } as unknown as Reflector;
}

beforeEach(() => {
  mockConsume.mockReset().mockResolvedValue(undefined);
  (RateLimiterRedis as Mock).mockClear();
});

describe('RateLimitGuard', () => {
  it('lets a @SkipRateLimit() route through without touching valkey', async () => {
    const valkey = fakeValkeyClient();
    const guard = new RateLimitGuard(valkey, fakeReflector({ skip: true }));
    const ctx = fakeExecutionContext(fakeRequest({ method: 'POST' }));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(valkey.exists).not.toHaveBeenCalled();
  });

  it('checks even a non-mutating verb when @RateLimit() is explicit', async () => {
    const valkey = fakeValkeyClient();
    const options: RateLimitOptions = { points: 2, durationSeconds: 30 };
    const guard = new RateLimitGuard(valkey, fakeReflector({ options }));
    const ctx = fakeExecutionContext(fakeRequest({ method: 'GET' }));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockConsume).toHaveBeenCalled();
  });

  it('passes a non-mutating verb through untouched when neither decorator is present', async () => {
    const valkey = fakeValkeyClient();
    const guard = new RateLimitGuard(valkey, fakeReflector());
    const ctx = fakeExecutionContext(fakeRequest({ method: 'GET' }));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(valkey.exists).not.toHaveBeenCalled();
    expect(mockConsume).not.toHaveBeenCalled();
  });

  it('falls back to DEFAULT_RATE_LIMIT for a mutating verb with neither decorator', async () => {
    const valkey = fakeValkeyClient();
    const guard = new RateLimitGuard(valkey, fakeReflector());
    const ctx = fakeExecutionContext(fakeRequest({ method: 'POST' }));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockConsume).toHaveBeenCalledWith(expect.stringContaining(':ip:127.0.0.1'));
  });

  it('lets a request through without consuming anything when appliesTo returns false', async () => {
    const valkey = fakeValkeyClient();
    const appliesTo = vi.fn().mockReturnValue(false);
    const options: RateLimitOptions = { points: 5, durationSeconds: 60, appliesTo };
    const guard = new RateLimitGuard(valkey, fakeReflector({ options }));
    const req = fakeRequest({ method: 'GET' });
    await expect(guard.canActivate(fakeExecutionContext(req))).resolves.toBe(true);
    expect(appliesTo).toHaveBeenCalledWith(req);
    expect(valkey.exists).not.toHaveBeenCalled();
    expect(mockConsume).not.toHaveBeenCalled();
  });

  it('throttles a request appliesTo returns true for', async () => {
    const valkey = fakeValkeyClient();
    const options: RateLimitOptions = { points: 5, durationSeconds: 60, appliesTo: () => true };
    const guard = new RateLimitGuard(valkey, fakeReflector({ options }));
    const ctx = fakeExecutionContext(fakeRequest({ method: 'GET' }));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockConsume).toHaveBeenCalledWith(expect.stringContaining(':ip:127.0.0.1'));
  });

  it('keys a perMember budget on the signed-in member, not the address', async () => {
    const valkey = fakeValkeyClient();
    const options: RateLimitOptions = { points: 5, durationSeconds: 60, perMember: true };
    const guard = new RateLimitGuard(valkey, fakeReflector({ options }));
    const req = fakeRequest({ method: 'POST', session: { memberId: 'member-1' } as never });
    await guard.canActivate(fakeExecutionContext(req));
    expect(mockConsume.mock.calls.map((call) => call[0])).toEqual([
      expect.stringMatching(/:member:member-1$/),
    ]);
  });

  it('falls back to the address for a perMember budget when nobody is signed in', async () => {
    const valkey = fakeValkeyClient();
    const options: RateLimitOptions = { points: 5, durationSeconds: 60, perMember: true };
    const guard = new RateLimitGuard(valkey, fakeReflector({ options }));
    await guard.canActivate(fakeExecutionContext(fakeRequest({ method: 'POST' })));
    expect(mockConsume).toHaveBeenCalledWith(expect.stringContaining(':ip:127.0.0.1'));
  });

  it('shares one counter across routes naming the same scope', async () => {
    const valkey = fakeValkeyClient();
    const options: RateLimitOptions = { points: 5, durationSeconds: 60, scope: 'shared' };
    const guard = new RateLimitGuard(valkey, fakeReflector({ options }));
    function routeA() {}
    function routeB() {}
    await guard.canActivate(fakeExecutionContext(fakeRequest({ method: 'POST' }), routeA));
    await guard.canActivate(fakeExecutionContext(fakeRequest({ method: 'POST' }), routeB));
    const keys = mockConsume.mock.calls.map((call) => call[0]);
    expect(keys).toEqual(['shared:ip:127.0.0.1', 'shared:ip:127.0.0.1']);
  });

  it('falls back to "unknown" for the IP dimension when the request has no IP', async () => {
    const valkey = fakeValkeyClient();
    const guard = new RateLimitGuard(valkey, fakeReflector());
    const ctx = fakeExecutionContext(fakeRequest({ method: 'POST', ip: undefined }));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockConsume).toHaveBeenCalledWith(expect.stringContaining(':ip:unknown'));
  });

  it('counts IPv6 callers by /64, so rotating host bits shares one budget', async () => {
    const valkey = fakeValkeyClient();
    const options: RateLimitOptions = { points: 5, durationSeconds: 60, scope: 'shared' };
    const guard = new RateLimitGuard(valkey, fakeReflector({ options }));
    for (const ip of ['2001:db8:1:2::1', '2001:db8:1:2:aaaa:bbbb:cccc:dddd']) {
      await guard.canActivate(fakeExecutionContext(fakeRequest({ method: 'POST', ip })));
    }
    const keys = mockConsume.mock.calls.map((call) => call[0]);
    expect(keys).toEqual(['shared:ip:2001:db8:1:2::/64', 'shared:ip:2001:db8:1:2::/64']);
  });

  it('scopes the dimension key per route, so two handlers never share a counter', async () => {
    const valkey = fakeValkeyClient();
    const options: RateLimitOptions = { points: 5, durationSeconds: 60 };
    const guard = new RateLimitGuard(valkey, fakeReflector({ options }));

    function signIn() {}
    class SignInController {}
    function register() {}
    class RegistrationController {}

    await guard.canActivate(
      fakeExecutionContext(fakeRequest({ method: 'POST' }), signIn, SignInController),
    );
    await guard.canActivate(
      fakeExecutionContext(fakeRequest({ method: 'POST' }), register, RegistrationController),
    );

    const keys = mockConsume.mock.calls.map((call) => call[0]);
    expect(keys[0]).toContain('SignInController#signIn');
    expect(keys[1]).toContain('RegistrationController#register');
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('normalizes the identifier dimension by case, so Foo@Bar.com and foo@bar.com collide (regression: cbab0fd6)', async () => {
    const valkey = fakeValkeyClient();
    const options: RateLimitOptions = {
      points: 5,
      durationSeconds: 60,
      identifierField: 'email',
    };
    const guard = new RateLimitGuard(valkey, fakeReflector({ options }));

    await guard.canActivate(
      fakeExecutionContext(fakeRequest({ method: 'POST', body: { email: 'Foo@Bar.com' } })),
    );
    const firstIdKey = mockConsume.mock.calls
      .map((call) => call[0])
      .find((key) => key.includes(':id:'));

    mockConsume.mockClear();
    await guard.canActivate(
      fakeExecutionContext(fakeRequest({ method: 'POST', body: { email: 'foo@bar.com' } })),
    );
    const secondIdKey = mockConsume.mock.calls
      .map((call) => call[0])
      .find((key) => key.includes(':id:'));

    expect(firstIdKey).toBeDefined();
    expect(firstIdKey).toBe(secondIdKey);
  });

  it('keys the identifier dimension on a fixed-size hash, never the raw value', async () => {
    const valkey = fakeValkeyClient();
    const options: RateLimitOptions = {
      points: 5,
      durationSeconds: 60,
      identifierField: 'email',
    };
    const guard = new RateLimitGuard(valkey, fakeReflector({ options }));
    const oversized = `${'x'.repeat(100_000)}@example.com`;

    await guard.canActivate(
      fakeExecutionContext(fakeRequest({ method: 'POST', body: { email: oversized } })),
    );
    const idKey = mockConsume.mock.calls.map((call) => call[0]).find((key) => key.includes(':id:'));

    expect(idKey).toBeDefined();
    expect(idKey).not.toContain('@example.com');
    expect(idKey!.split(':id:')[1]).toHaveLength(43); // base64url SHA-256
  });

  describe('the tagged-mailbox dimension', () => {
    const options: RateLimitOptions = {
      points: 5,
      durationSeconds: 60,
      identifierField: 'email',
      taggedMailbox: { points: 2, durationSeconds: 86400 },
    };

    async function keysFor(email: string): Promise<string[]> {
      mockConsume.mockClear();
      const guard = new RateLimitGuard(fakeValkeyClient(), fakeReflector({ options }));
      await guard.canActivate(
        fakeExecutionContext(fakeRequest({ method: 'POST', body: { email } })),
      );
      return mockConsume.mock.calls.map((call) => call[0]);
    }

    it('pools every tag variant of a mailbox under one key, on its own budget', async () => {
      const first = (await keysFor('Inbox+1@example.test')).find((key) =>
        key.includes(':mailbox:'),
      );
      const second = (await keysFor('inbox+2@example.test')).find((key) =>
        key.includes(':mailbox:'),
      );

      expect(first).toBeDefined();
      expect(first).toBe(second);
      expect(first).not.toContain('inbox');
      const limiterBudgets = (RateLimiterRedis as Mock).mock.calls.map(
        (call) => call[0] as { points: number; duration: number },
      );
      expect(limiterBudgets).toContainEqual(
        expect.objectContaining({ points: 2, duration: 86400 }),
      );
    });

    it('leaves an untagged address off it, so spending it never denies the plain address', async () => {
      const keys = await keysFor('inbox@example.test');

      expect(keys.some((key) => key.includes(':mailbox:'))).toBe(false);
      expect(keys.some((key) => key.includes(':id:'))).toBe(true);
    });

    it('is not checked on a route without taggedMailbox', async () => {
      const guard = new RateLimitGuard(
        fakeValkeyClient(),
        fakeReflector({ options: { points: 5, durationSeconds: 60, identifierField: 'email' } }),
      );
      await guard.canActivate(
        fakeExecutionContext(
          fakeRequest({ method: 'POST', body: { email: 'inbox+1@example.test' } }),
        ),
      );

      expect(mockConsume.mock.calls.some((call) => call[0].includes(':mailbox:'))).toBe(false);
    });

    it('locks out on its own budget window', async () => {
      const valkey = fakeValkeyClient();
      // Checked in order: address, identifier, mailbox.
      mockConsume
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce({ msBeforeNext: 1000 });
      const guard = new RateLimitGuard(valkey, fakeReflector({ options }));

      await expect(
        guard.canActivate(
          fakeExecutionContext(
            fakeRequest({ method: 'POST', body: { email: 'inbox+3@example.test' } }),
          ),
        ),
      ).rejects.toThrow('Too many requests');
      // min(MAX_BLOCK_SECONDS, 86400 * 2^0)
      expect(valkey.set).toHaveBeenCalledWith(
        expect.stringContaining(':mailbox:'),
        '1',
        'EX',
        3600,
      );
    });
  });

  it('short-circuits to 429 when an existing block key is present, without consuming the limiter', async () => {
    const valkey = fakeValkeyClient({ exists: vi.fn().mockResolvedValue(1) });
    const guard = new RateLimitGuard(valkey, fakeReflector());
    const ctx = fakeExecutionContext(fakeRequest({ method: 'POST' }));
    await expect(guard.canActivate(ctx)).rejects.toThrow('Too many requests');
    expect(mockConsume).not.toHaveBeenCalled();
  });

  it('rethrows a real Error from consume() (e.g. a Valkey connection failure) as-is', async () => {
    const valkey = fakeValkeyClient();
    mockConsume.mockRejectedValue(new Error('ECONNREFUSED'));
    const guard = new RateLimitGuard(valkey, fakeReflector());
    const ctx = fakeExecutionContext(fakeRequest({ method: 'POST' }));
    await expect(guard.canActivate(ctx)).rejects.toThrow('ECONNREFUSED');
  });

  it('locks out and returns 429 when the limiter budget is exhausted (a non-Error rejection)', async () => {
    const valkey = fakeValkeyClient({ incr: vi.fn().mockResolvedValue(1) });
    mockConsume.mockRejectedValue({ msBeforeNext: 1000 });
    const guard = new RateLimitGuard(valkey, fakeReflector());
    const ctx = fakeExecutionContext(fakeRequest({ method: 'POST' }));
    await expect(guard.canActivate(ctx)).rejects.toThrow('Too many requests');
    // durationSeconds(60) * 2^(strikes(1)-1) = 60
    expect(valkey.set).toHaveBeenCalledWith(expect.stringContaining('rl:block:'), '1', 'EX', 60);
  });

  it('doubles the block duration with each further strike', async () => {
    const valkey = fakeValkeyClient({ incr: vi.fn().mockResolvedValue(3) });
    mockConsume.mockRejectedValue({ msBeforeNext: 1000 });
    const guard = new RateLimitGuard(valkey, fakeReflector());
    const ctx = fakeExecutionContext(fakeRequest({ method: 'POST' }));
    await expect(guard.canActivate(ctx)).rejects.toThrow('Too many requests');
    // 60 * 2^(3-1) = 240
    expect(valkey.set).toHaveBeenCalledWith(expect.stringContaining('rl:block:'), '1', 'EX', 240);
  });

  it('caps the block duration at MAX_BLOCK_SECONDS regardless of strike count', async () => {
    const valkey = fakeValkeyClient({ incr: vi.fn().mockResolvedValue(20) });
    mockConsume.mockRejectedValue({ msBeforeNext: 1000 });
    const guard = new RateLimitGuard(valkey, fakeReflector());
    const ctx = fakeExecutionContext(fakeRequest({ method: 'POST' }));
    await expect(guard.canActivate(ctx)).rejects.toThrow('Too many requests');
    expect(valkey.set).toHaveBeenCalledWith(expect.stringContaining('rl:block:'), '1', 'EX', 3600);
  });

  it('reuses one RateLimiterRedis instance across routes sharing the same points/duration', async () => {
    const valkey = fakeValkeyClient();
    const options: RateLimitOptions = { points: 5, durationSeconds: 60 };
    const guard = new RateLimitGuard(valkey, fakeReflector({ options }));
    function routeA() {}
    function routeB() {}
    await guard.canActivate(fakeExecutionContext(fakeRequest({ method: 'POST' }), routeA));
    await guard.canActivate(fakeExecutionContext(fakeRequest({ method: 'POST' }), routeB));
    expect((RateLimiterRedis as Mock).mock.calls).toHaveLength(1);
  });
});

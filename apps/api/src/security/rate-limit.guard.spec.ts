import { Reflector } from '@nestjs/core';
import type { RedisClientType } from 'redis';
import { RateLimitGuard } from './rate-limit.guard';
import { RATE_LIMIT_OPTIONS, RateLimitOptions } from './rate-limit.constants';
import { SKIP_RATE_LIMIT_KEY } from './skip-rate-limit.decorator';
import { fakeExecutionContext, fakeRequest } from '../test-support/fake-http-context';

// Every `new RateLimiterRedis()` the guard creates internally shares this
// one mocked consume() — the guard caches at most one limiter per
// points/duration pair on itself, so tests only ever need to control this
// single function. (Prefixed `mock` so the babel-plugin-jest-hoist
// exception lets jest.mock's hoisted factory reference it.)
// Typed explicitly so `.mock.calls` (read in a couple of tests below) comes
// out as `[string][]` rather than `any[][]`.
const mockConsume = jest.fn<Promise<void>, [string]>();
jest.mock('rate-limiter-flexible', () => ({
  RateLimiterRedis: jest.fn().mockImplementation(() => ({ consume: mockConsume })),
}));
import { RateLimiterRedis } from 'rate-limiter-flexible';

function fakeValkeyClient(overrides: Partial<RedisClientType> = {}): RedisClientType {
  return {
    exists: jest.fn().mockResolvedValue(0),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
    isOpen: true,
    quit: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as RedisClientType;
}

function fakeReflector(opts: { skip?: boolean; options?: RateLimitOptions } = {}): Reflector {
  return {
    get: jest.fn((key: string | symbol) => {
      if (key === SKIP_RATE_LIMIT_KEY) return opts.skip;
      if (key === RATE_LIMIT_OPTIONS) return opts.options;
      return undefined;
    }),
  } as unknown as Reflector;
}

beforeEach(() => {
  mockConsume.mockReset().mockResolvedValue(undefined);
  (RateLimiterRedis as jest.Mock).mockClear();
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

  it('falls back to "unknown" for the IP dimension when the request has no IP', async () => {
    const valkey = fakeValkeyClient();
    const guard = new RateLimitGuard(valkey, fakeReflector());
    const ctx = fakeExecutionContext(fakeRequest({ method: 'POST', ip: undefined }));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockConsume).toHaveBeenCalledWith(expect.stringContaining(':ip:unknown'));
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

  it('short-circuits to 429 when an existing block key is present, without consuming the limiter', async () => {
    const valkey = fakeValkeyClient({ exists: jest.fn().mockResolvedValue(1) });
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
    const valkey = fakeValkeyClient({ incr: jest.fn().mockResolvedValue(1) });
    mockConsume.mockRejectedValue({ msBeforeNext: 1000 });
    const guard = new RateLimitGuard(valkey, fakeReflector());
    const ctx = fakeExecutionContext(fakeRequest({ method: 'POST' }));
    await expect(guard.canActivate(ctx)).rejects.toThrow('Too many requests');
    // durationSeconds(60) * 2^(strikes(1)-1) = 60
    expect(valkey.set).toHaveBeenCalledWith(
      expect.stringContaining('rl:block:'),
      '1',
      expect.objectContaining({ EX: 60 }),
    );
  });

  it('doubles the block duration with each further strike', async () => {
    const valkey = fakeValkeyClient({ incr: jest.fn().mockResolvedValue(3) });
    mockConsume.mockRejectedValue({ msBeforeNext: 1000 });
    const guard = new RateLimitGuard(valkey, fakeReflector());
    const ctx = fakeExecutionContext(fakeRequest({ method: 'POST' }));
    await expect(guard.canActivate(ctx)).rejects.toThrow('Too many requests');
    // 60 * 2^(3-1) = 240
    expect(valkey.set).toHaveBeenCalledWith(
      expect.stringContaining('rl:block:'),
      '1',
      expect.objectContaining({ EX: 240 }),
    );
  });

  it('caps the block duration at MAX_BLOCK_SECONDS regardless of strike count', async () => {
    const valkey = fakeValkeyClient({ incr: jest.fn().mockResolvedValue(20) });
    mockConsume.mockRejectedValue({ msBeforeNext: 1000 });
    const guard = new RateLimitGuard(valkey, fakeReflector());
    const ctx = fakeExecutionContext(fakeRequest({ method: 'POST' }));
    await expect(guard.canActivate(ctx)).rejects.toThrow('Too many requests');
    expect(valkey.set).toHaveBeenCalledWith(
      expect.stringContaining('rl:block:'),
      '1',
      expect.objectContaining({ EX: 3600 }),
    );
  });

  it('reuses one RateLimiterRedis instance across routes sharing the same points/duration', async () => {
    const valkey = fakeValkeyClient();
    const options: RateLimitOptions = { points: 5, durationSeconds: 60 };
    const guard = new RateLimitGuard(valkey, fakeReflector({ options }));
    function routeA() {}
    function routeB() {}
    await guard.canActivate(fakeExecutionContext(fakeRequest({ method: 'POST' }), routeA));
    await guard.canActivate(fakeExecutionContext(fakeRequest({ method: 'POST' }), routeB));
    expect((RateLimiterRedis as jest.Mock).mock.calls).toHaveLength(1);
  });

  describe('onModuleDestroy', () => {
    it('quits an open valkey connection', async () => {
      const valkey = fakeValkeyClient({ isOpen: true });
      const guard = new RateLimitGuard(valkey, fakeReflector());
      await guard.onModuleDestroy();
      expect(valkey.quit).toHaveBeenCalled();
    });

    it('does not quit an already-closed connection', async () => {
      const valkey = fakeValkeyClient({ isOpen: false });
      const guard = new RateLimitGuard(valkey, fakeReflector());
      await guard.onModuleDestroy();
      expect(valkey.quit).not.toHaveBeenCalled();
    });
  });
});

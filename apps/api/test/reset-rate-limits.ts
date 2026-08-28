import { createClient, type RedisClientType } from 'redis';

// Every integration spec file runs in the same process against the same
// shared Valkey instance for the whole `test:integration` run (see
// integration-global-setup.ts) — and every request in this suite comes
// from the same loopback source IP. Without a reset, the real
// RateLimitGuard's ip-dimension counters/lockouts (rl:ip:..., rl:block:
// ip:...) bleed across files: a wrong-password test in one file (e.g.
// members/resend-activation, members/profile, auth/change-password) can
// trip the shared IP's lockout, and every sign-in after that — even with
// correct credentials, in an unrelated file — gets throttled. The sign-in
// endpoint's anti-enumeration filter (auth/sign-in-throttle-audit.filter)
// then reports that as an ordinary generic 401, indistinguishable from a
// real failure, so the false throttle looks like a broken test instead
// of a rate-limit hit.
//
// Flush the guard's own keys before every test across the whole suite —
// the same cleanup security/rate-limit.integration-spec.ts already does
// for itself, just applied globally instead of to one file.
let redis: RedisClientType;

beforeAll(async () => {
  redis = createClient({ url: process.env.VALKEY_URL });
  await redis.connect();
});

beforeEach(async () => {
  const keys = await redis.keys('rl:*');
  if (keys.length > 0) {
    await redis.del(keys);
  }
});

afterAll(async () => {
  await redis.quit();
});

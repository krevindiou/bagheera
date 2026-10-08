import IORedis from 'ioredis';

// Every spec shares one Valkey and one loopback IP, so RateLimitGuard's
// counters and lockouts (`rl:*`) would bleed across tests and throttle
// unrelated ones. Flushed before every test.
let redis: IORedis;

beforeAll(() => {
  redis = new IORedis(process.env.VALKEY_URL!);
});

beforeEach(async () => {
  const keys = await redis.keys('rl:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
});

afterAll(async () => {
  await redis.quit();
});

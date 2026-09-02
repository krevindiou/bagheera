import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { createClient, type RedisClientType } from 'redis';
import request from 'supertest';
import { SessionModule } from '../session/session.module';
import { DEFAULT_RATE_LIMIT } from './rate-limit.constants';
import { RateLimit } from './rate-limit.decorator';
import { SecurityModule } from './security.module';
import { SkipRateLimit } from './skip-rate-limit.decorator';

// Test-only controller — exists solely to exercise RateLimitGuard from
// outside; never registered in the real app. No @UseGuards(RateLimitGuard)
// on any handler below: importing SecurityModule alone makes it global
// (APP_GUARD) here exactly as it is in the real app — adding it back per
// handler would run the guard twice per request.
@Controller('__test-rate-limit')
class TestRateLimitController {
  @Post('attempt')
  @HttpCode(200)
  @RateLimit({ points: 3, durationSeconds: 60, identifierField: 'email' })
  attempt(@Body() body: { email?: string }) {
    return { ok: true, email: body.email ?? null };
  }

  @Get('unannotated-read')
  unannotatedRead() {
    return { ok: true };
  }

  @Get('explicit-read')
  @RateLimit({ points: 1, durationSeconds: 60 })
  explicitRead() {
    return { ok: true };
  }

  @Post('skipped')
  @HttpCode(200)
  @SkipRateLimit()
  skipped() {
    return { ok: true };
  }

  @Post('unannotated-write')
  @HttpCode(200)
  unannotatedWrite() {
    return { ok: true };
  }
}

// Test-only controller — exists solely to exercise the relative order
// RateLimitGuard and SessionAuthGuard run in as real global APP_GUARDs;
// never registered in the real app. Deliberately carries no guard-related
// decorator of its own.
@Controller('__test-guard-order')
class TestGuardOrderController {
  @Get('attempt')
  @RateLimit({ points: 1, durationSeconds: 60 })
  attempt() {
    return { ok: true };
  }
}

describe('RateLimitGuard (integration)', () => {
  let app: NestExpressApplication;
  let redis: RedisClientType;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), SecurityModule],
      controllers: [TestRateLimitController],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.set('trust proxy', 1);
    await app.init();

    redis = createClient({ url: process.env.VALKEY_URL });
    await redis.connect();
  });

  afterAll(async () => {
    await redis.quit();
    await app.close();
  });

  beforeEach(async () => {
    const keys = await redis.keys('rl:*');
    if (keys.length > 0) {
      await redis.del(keys);
    }
  });

  it('throttles the (N+1)th request within the window for a given key', async () => {
    const email = 'throttle-me@example.com';

    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post('/__test-rate-limit/attempt')
        .send({ email })
        .expect(200);
    }

    await request(app.getHttpServer())
      .post('/__test-rate-limit/attempt')
      .send({ email })
      .expect(429);
  });

  it('tracks distinct identifiers independently (same source IP throttled per-account, other accounts unaffected)', async () => {
    const exhausted = 'exhausted@example.com';
    const fresh = 'fresh@example.com';

    // Distinct source IPs so this test isolates the identifier dimension
    // from the IP dimension (both are checked — see the IP-dimension test
    // below for the complementary case).
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post('/__test-rate-limit/attempt')
        .set('X-Forwarded-For', '10.0.0.1')
        .send({ email: exhausted })
        .expect(200);
    }
    await request(app.getHttpServer())
      .post('/__test-rate-limit/attempt')
      .set('X-Forwarded-For', '10.0.0.1')
      .send({ email: exhausted })
      .expect(429);

    // A different identifier still has its own untouched budget, even from
    // the very same source IP that just got locked out above.
    await request(app.getHttpServer())
      .post('/__test-rate-limit/attempt')
      .set('X-Forwarded-For', '10.0.0.1')
      .send({ email: fresh })
      .expect(200);
  });

  it('tracks distinct source IPs independently (account-level throttling alone is not enough)', async () => {
    const email = 'shared-account@example.com';

    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post('/__test-rate-limit/attempt')
        .set('X-Forwarded-For', '10.0.0.2')
        .send({ email })
        .expect(200);
    }
    await request(app.getHttpServer())
      .post('/__test-rate-limit/attempt')
      .set('X-Forwarded-For', '10.0.0.2')
      .send({ email })
      .expect(429);

    // Same account, different source IP: still throttled independently —
    // an attacker can't dodge the account-level limit by rotating IPs,
    // but a fresh IP against the same account has its own IP-dimension
    // budget (the account dimension is what's exhausted here).
    await request(app.getHttpServer())
      .post('/__test-rate-limit/attempt')
      .set('X-Forwarded-For', '10.0.0.3')
      .send({ email })
      .expect(429);
  });

  it('escalates the lockout duration on repeated violations of the same dimension', async () => {
    const email = 'repeat-offender@example.com';

    const exhaust = () =>
      request(app.getHttpServer())
        .post('/__test-rate-limit/attempt')
        .set('X-Forwarded-For', '10.0.0.4')
        .send({ email });

    for (let i = 0; i < 3; i++) {
      await exhaust().expect(200);
    }
    // First violation: locked out, base window (60s) applies.
    await exhaust().expect(429);
    const strikeKey = 'rl:strikes:id:repeat-offender@example.com';
    const blockKey = 'rl:block:id:repeat-offender@example.com';
    expect(await redis.get(strikeKey)).toBe('1');
    const firstBlockTtl = await redis.ttl(blockKey);
    expect(firstBlockTtl).toBeGreaterThan(0);
    expect(firstBlockTtl).toBeLessThanOrEqual(60);

    // Simulate that lockout having expired (rather than waiting 60s for
    // real): clear the block and the underlying consume-counter, but keep
    // the strike count, exactly as if the dimension came back and violated
    // the limit again before its strikes decayed.
    await redis.del(blockKey);
    await redis.del('rl:id:repeat-offender@example.com');
    for (let i = 0; i < 3; i++) {
      await exhaust().expect(200);
    }
    await exhaust().expect(429);

    // Second violation: the strike count doubled the block duration.
    expect(await redis.get(strikeKey)).toBe('2');
    const secondBlockTtl = await redis.ttl(blockKey);
    expect(secondBlockTtl).toBeGreaterThan(60);
    expect(secondBlockTtl).toBeLessThanOrEqual(120);
  });

  it('lets an unannotated GET through untouched, no matter how many times it repeats', async () => {
    for (let i = 0; i < DEFAULT_RATE_LIMIT.points + 2; i++) {
      await request(app.getHttpServer())
        .get('/__test-rate-limit/unannotated-read')
        .expect(200);
    }
  });

  it('still applies an explicit @RateLimit budget to a GET, not just mutating verbs', async () => {
    await request(app.getHttpServer())
      .get('/__test-rate-limit/explicit-read')
      .expect(200);
    await request(app.getHttpServer())
      .get('/__test-rate-limit/explicit-read')
      .expect(429);
  });

  it('lets @SkipRateLimit through untouched on a mutating route, past what the default budget would allow', async () => {
    for (let i = 0; i < DEFAULT_RATE_LIMIT.points + 2; i++) {
      await request(app.getHttpServer())
        .post('/__test-rate-limit/skipped')
        .expect(200);
    }
  });

  it('falls back to DEFAULT_RATE_LIMIT for a mutating route with neither decorator', async () => {
    for (let i = 0; i < DEFAULT_RATE_LIMIT.points; i++) {
      await request(app.getHttpServer())
        .post('/__test-rate-limit/unannotated-write')
        .expect(200);
    }
    await request(app.getHttpServer())
      .post('/__test-rate-limit/unannotated-write')
      .expect(429);
  });
});

describe('RateLimitGuard vs SessionAuthGuard ordering (integration)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        // Mirrors app.module.ts's import order deliberately — see the
        // comment there and on RateLimitGuard for why it matters.
        SessionModule,
        SecurityModule,
      ],
      controllers: [TestGuardOrderController],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.set('trust proxy', 1);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an unauthenticated request with 401 before RateLimitGuard ever runs, however many times it repeats', async () => {
    // budget is 1 — if RateLimitGuard ran first, the 2nd request onward
    // would come back 429 instead of 401, proving SessionAuthGuard runs
    // first rather than both merely rejecting it independently.
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .get('/__test-guard-order/attempt')
        .expect(401);
    }
  });
});

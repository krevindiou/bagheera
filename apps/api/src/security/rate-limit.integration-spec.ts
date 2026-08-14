import {
  Body,
  Controller,
  HttpCode,
  INestApplication,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createClient, type RedisClientType } from 'redis';
import request from 'supertest';
import type { App } from 'supertest/types';
import { RateLimit } from './rate-limit.decorator';
import { RateLimitGuard } from './rate-limit.guard';
import { SecurityModule } from './security.module';

// Test-only controller — exists solely to exercise RateLimitGuard from
// outside; never registered in the real app.
@Controller('__test-rate-limit')
class TestRateLimitController {
  @Post('attempt')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  @RateLimit({ points: 3, durationSeconds: 60, identifierField: 'email' })
  attempt(@Body() body: { email?: string }) {
    return { ok: true, email: body.email ?? null };
  }
}

describe('RateLimitGuard (integration)', () => {
  let app: INestApplication<App>;
  let redis: RedisClientType;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), SecurityModule],
      controllers: [TestRateLimitController],
    }).compile();

    app = moduleRef.createNestApplication();
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

  it('tracks distinct identifiers independently', async () => {
    const exhausted = 'exhausted@example.com';
    const fresh = 'fresh@example.com';

    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post('/__test-rate-limit/attempt')
        .send({ email: exhausted })
        .expect(200);
    }
    await request(app.getHttpServer())
      .post('/__test-rate-limit/attempt')
      .send({ email: exhausted })
      .expect(429);

    // A different identifier still has its own untouched budget.
    await request(app.getHttpServer())
      .post('/__test-rate-limit/attempt')
      .send({ email: fresh })
      .expect(200);
  });
});

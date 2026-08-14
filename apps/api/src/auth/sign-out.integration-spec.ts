import { Controller, Get, Req, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { createClient, type RedisClientType } from 'redis';
import { DbModule } from '../db/db.module';
import { SecurityModule } from '../security/security.module';
import { SessionModule } from '../session/session.module';
import { SessionTerminationService } from '../session/session-termination.service';
import { SESSION_COOKIE_NAME } from '../session/session.constants';
import { AuthModule } from './auth.module';

// Test-only controller — mints a CSRF token/cookie pair; never shipped.
@Controller('__test-csrf')
class TestCsrfController {
  @Get('token')
  token(@Req() req: Request) {
    req.session.marker = true;
    return { csrfToken: req.csrfToken!() };
  }
}

declare module 'express-session' {
  interface SessionData {
    marker?: boolean;
  }
}

function cookiePair(setCookieHeader: string): string {
  return setCookieHeader.split(';')[0];
}

function sessionIdFromCookie(cookie: string): string {
  const raw = decodeURIComponent(cookie.split(';')[0].split('=')[1]);
  return raw.split('.')[0].replace(/^s:/, '');
}

describe('sign-out (integration)', () => {
  let app: NestExpressApplication;
  let redis: RedisClientType;
  let terminationService: SessionTerminationService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DbModule,
        SecurityModule,
        SessionModule,
        AuthModule,
      ],
      controllers: [TestCsrfController],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.set('trust proxy', 1);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    terminationService = moduleRef.get(SessionTerminationService);

    redis = createClient({ url: process.env.VALKEY_URL });
    await redis.connect();
  });

  afterAll(async () => {
    await redis.quit();
    await app.close();
  });

  async function getCsrfTokenAndCookies(): Promise<{
    token: string;
    cookies: string[];
  }> {
    const res = await request(app.getHttpServer())
      .get('/__test-csrf/token')
      .set('X-Forwarded-Proto', 'https')
      .expect(200);
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    return {
      token: (res.body as { csrfToken: string }).csrfToken,
      cookies: setCookie.map(cookiePair),
    };
  }

  it('invalidates the current session on sign-out', async () => {
    const { token, cookies } = await getCsrfTokenAndCookies();
    const sessionCookie = cookies.find((c) =>
      c.startsWith(`${SESSION_COOKIE_NAME}=`),
    )!;
    const sid = sessionIdFromCookie(sessionCookie);
    expect(await redis.exists(`sess:${sid}`)).toBe(1);

    const res = await request(app.getHttpServer())
      .post('/auth/sign-out')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(200);
    expect(await redis.exists(`sess:${sid}`)).toBe(0);
  });

  it('terminateOtherSessions removes every session for the member except the excepted one', async () => {
    await redis.set('sess:keep-me', JSON.stringify({ memberId: 42 }));
    await redis.set('sess:remove-me', JSON.stringify({ memberId: 42 }));
    await redis.set('sess:other-member', JSON.stringify({ memberId: 99 }));

    await terminationService.terminateOtherSessions(42, 'keep-me');

    expect(await redis.exists('sess:keep-me')).toBe(1);
    expect(await redis.exists('sess:remove-me')).toBe(0);
    expect(await redis.exists('sess:other-member')).toBe(1);

    await redis.del(['sess:keep-me', 'sess:other-member']);
  });
});

import { Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { createClient, type RedisClientType } from 'redis';
import request from 'supertest';
import { SessionRotationService } from './session-rotation.service';
import {
  SESSION_COOKIE_NAME,
  SESSION_IDLE_TTL_SECONDS,
} from './session.constants';
import { SessionModule } from './session.module';

declare module 'express-session' {
  interface SessionData {
    sessionMarker?: string;
    csrfIssued?: boolean;
  }
}

// Test-only controller — exists solely to exercise the session/CSRF
// middleware chain from outside; never registered in the real app.
@Controller('__test-session')
class TestSessionController {
  constructor(private readonly rotation: SessionRotationService) {}

  @Get('csrf-token')
  csrfToken(@Req() req: Request) {
    // Force the session to persist so the id used to derive this token's
    // HMAC (getSessionIdentifier) stays stable across requests — without
    // this, saveUninitialized:false would drop the never-modified session
    // and a later request would mint a different id.
    req.session.csrfIssued = true;
    return { csrfToken: req.csrfToken!() };
  }

  @Post('touch')
  @HttpCode(200)
  touch(@Req() req: Request) {
    req.session.sessionMarker = 'set';
    return { id: req.session.id };
  }

  @Post('rotate')
  @HttpCode(200)
  async rotate(@Req() req: Request) {
    const previousId = req.session.id;
    await this.rotation.rotate(req);
    return {
      previousId,
      newId: req.session.id,
      sessionMarker: req.session.sessionMarker,
    };
  }
}

function sessionIdFromCookie(cookie: string): string {
  const raw = decodeURIComponent(cookie.split(';')[0].split('=')[1]);
  return raw.split('.')[0].replace(/^s:/, '');
}

/** name=value out of a Set-Cookie header, dropping attributes (Secure etc). */
function cookiePair(setCookieHeader: string): string {
  return setCookieHeader.split(';')[0];
}

describe('session infrastructure + CSRF (integration)', () => {
  let app: NestExpressApplication;
  let redis: RedisClientType;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), SessionModule],
      controllers: [TestSessionController],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    // Mirrors main.ts: production sits behind Caddy (TLS-terminating), so
    // req.secure must come from X-Forwarded-Proto for Secure cookies to be
    // set. Requests below send that header the same way Caddy would.
    app.set('trust proxy', 1);
    await app.init();

    redis = createClient({ url: process.env.VALKEY_URL });
    await redis.connect();
  });

  afterAll(async () => {
    await redis.quit();
    await app.close();
  });

  // supertest's server runs plain http, and superagent's cookie jar honours
  // the Secure attribute (won't replay a Secure cookie over http) — so
  // cookies are threaded through requests manually here rather than via
  // request.agent()'s implicit jar.
  async function getCsrfTokenAndCookies(): Promise<{
    token: string;
    cookies: string[];
  }> {
    const res = await request(app.getHttpServer())
      .get('/__test-session/csrf-token')
      .set('X-Forwarded-Proto', 'https')
      .expect(200);
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    return {
      token: (res.body as { csrfToken: string }).csrfToken,
      cookies: setCookie.map(cookiePair),
    };
  }

  it('sets a session cookie with Secure/HttpOnly/SameSite and stores it in Valkey with the idle TTL', async () => {
    const { token, cookies } = await getCsrfTokenAndCookies();

    const res = await request(app.getHttpServer())
      .post('/__test-session/touch')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .expect(200);

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const sessionCookie = setCookie.find((c) =>
      c.startsWith(`${SESSION_COOKIE_NAME}=`),
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie).toMatch(/Secure/i);
    expect(sessionCookie).toMatch(/SameSite=Lax/i);

    const sid = sessionIdFromCookie(sessionCookie!);
    const ttl = await redis.ttl(`sess:${sid}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(SESSION_IDLE_TTL_SECONDS);
    expect(ttl).toBeGreaterThan(SESSION_IDLE_TTL_SECONDS - 30);
  });

  it('rejects a POST without a CSRF token', async () => {
    const { cookies } = await getCsrfTokenAndCookies();
    await request(app.getHttpServer())
      .post('/__test-session/touch')
      .set('Cookie', cookies)
      .set('X-Forwarded-Proto', 'https')
      .expect(403);
  });

  it('rotation helper produces a new session id while preserving session data', async () => {
    const { token, cookies } = await getCsrfTokenAndCookies();

    const first = await request(app.getHttpServer())
      .post('/__test-session/touch')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .expect(200);
    const firstId = (first.body as { id: string }).id;
    const cookiesAfterFirst = (
      first.headers['set-cookie'] as unknown as string[]
    ).map(cookiePair);
    // Keep the csrf cookie from the first exchange alongside whatever
    // session cookie the touch call refreshed.
    const mergedCookies = [
      ...cookies.filter((c) => !c.startsWith(`${SESSION_COOKIE_NAME}=`)),
      ...cookiesAfterFirst,
    ];

    const rotated = await request(app.getHttpServer())
      .post('/__test-session/rotate')
      .set('Cookie', mergedCookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .expect(200);
    const body = rotated.body as {
      previousId: string;
      newId: string;
      sessionMarker: string;
    };

    expect(body.previousId).toBe(firstId);
    expect(body.newId).not.toBe(firstId);
    expect(body.sessionMarker).toBe('set');
  });
});

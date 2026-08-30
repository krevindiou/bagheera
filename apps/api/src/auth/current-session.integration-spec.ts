import { Controller, Get, Req, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import {
  connectIntegrationDb,
  IntegrationDb,
} from '../db/test-utils/integration-db';
import { DbModule } from '../db/db.module';
import { member } from '../db/schema';
import { EmailModule } from '../email/email.module';
import { EMAIL_PROVIDER } from '../email/email.constants';
import type { EmailProvider } from '../email/email-message';
import { HashService } from '../security/hash.service';
import { SecurityModule } from '../security/security.module';
import { SessionModule } from '../session/session.module';
import { AuthModule } from './auth.module';

class FakeEmailProvider implements EmailProvider {
  send(): Promise<void> {
    return Promise.resolve();
  }
}

// Test-only controller — mints a CSRF token/cookie pair the same way the
// real session middleware requires; never shipped in the app.
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

describe('GET /auth/me (integration)', () => {
  let app: NestExpressApplication;
  let ctx: IntegrationDb;
  let hash: HashService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DbModule,
        SecurityModule,
        SessionModule,
        EmailModule,
        AuthModule,
      ],
      controllers: [TestCsrfController],
    })
      .overrideProvider(EMAIL_PROVIDER)
      .useValue(new FakeEmailProvider())
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.set('trust proxy', 1);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    hash = moduleRef.get(HashService);
    ctx = connectIntegrationDb();
  });

  afterAll(async () => {
    await ctx.pool.end();
    await app.close();
  });

  beforeEach(async () => {
    await ctx.db.execute(
      sql`truncate table ${member} restart identity cascade`,
    );
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

  it('returns 401 when there is no active session', async () => {
    const { cookies } = await getCsrfTokenAndCookies();

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookies)
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(401);
  });

  it("returns the signed-in member's email once signed in", async () => {
    const passwordHash = await hash.hash('correct-horse');
    await ctx.db.insert(member).values({
      email: 'Active@Example.com',
      password: passwordHash,
      country: 'FR',
      active: true,
    });

    const { token, cookies } = await getCsrfTokenAndCookies();
    const signInRes = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ email: 'Active@Example.com', password: 'correct-horse' })
      .expect(200);
    const sessionCookies = (
      signInRes.headers['set-cookie'] as unknown as string[]
    ).map(cookiePair);

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', sessionCookies)
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ email: 'Active@Example.com' });
  });
});

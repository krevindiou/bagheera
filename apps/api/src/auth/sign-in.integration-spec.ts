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
import { SESSION_COOKIE_NAME } from '../session/session.constants';
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

describe('sign-in (integration)', () => {
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

  async function createMember(opts: {
    email: string;
    password: string;
    active: boolean;
  }) {
    const passwordHash = await hash.hash(opts.password);
    const [row] = await ctx.db
      .insert(member)
      .values({
        email: opts.email,
        password: passwordHash,
        country: 'FR',
        active: opts.active,
      })
      .returning();
    return row;
  }

  it('issues a session, rotates the session id, and sets logged_at on success', async () => {
    await createMember({
      email: 'active@example.com',
      password: 'correct-horse',
      active: true,
    });
    const { token, cookies } = await getCsrfTokenAndCookies();
    const preSignInSessionCookie = cookies.find((c) =>
      c.startsWith(`${SESSION_COOKIE_NAME}=`),
    );

    const res = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ email: 'Active@Example.com', password: 'correct-horse' });

    expect(res.status).toBe(200);
    const postSignInSetCookie = res.headers['set-cookie'] as unknown as
      string[] | undefined;
    const postSignInSessionCookie = postSignInSetCookie
      ?.map(cookiePair)
      .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    expect(postSignInSessionCookie).toBeDefined();
    expect(postSignInSessionCookie).not.toBe(preSignInSessionCookie);

    const [row] = await ctx.db.select().from(member);
    expect(row.loggedAt).not.toBeNull();
  });

  it('returns a distinct error for correct credentials against an inactive member', async () => {
    await createMember({
      email: 'inactive@example.com',
      password: 'correct-horse',
      active: false,
    });
    const { token, cookies } = await getCsrfTokenAndCookies();

    const res = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ email: 'inactive@example.com', password: 'correct-horse' });

    expect(res.status).toBe(403);
  });

  it('returns the identical generic error for a wrong password and for an unknown email', async () => {
    await createMember({
      email: 'known@example.com',
      password: 'correct-horse',
      active: true,
    });
    const { token, cookies } = await getCsrfTokenAndCookies();

    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ email: 'known@example.com', password: 'wrong-password' });

    const { token: token2, cookies: cookies2 } = await getCsrfTokenAndCookies();
    const unknownEmail = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .set('Cookie', cookies2)
      .set('x-csrf-token', token2)
      .set('X-Forwarded-Proto', 'https')
      .send({ email: 'nobody@example.com', password: 'whatever123' });

    expect(wrongPassword.status).toBe(unknownEmail.status);
    // Compare everything except `timestamp`, which legitimately differs
    // between two sequential requests.
    expect(omitTimestamp(wrongPassword.body)).toEqual(
      omitTimestamp(unknownEmail.body),
    );
  });

  it('throttles repeated attempts for the same email, indistinguishably from an ordinary wrong-password failure', async () => {
    await createMember({
      email: 'throttled@example.com',
      password: 'correct-horse',
      active: true,
    });

    let lastResponse: request.Response | undefined;
    for (let i = 0; i < 6; i++) {
      const { token, cookies } = await getCsrfTokenAndCookies();
      lastResponse = await request(app.getHttpServer())
        .post('/auth/sign-in')
        .set('Cookie', cookies)
        .set('x-csrf-token', token)
        .set('X-Forwarded-Proto', 'https')
        .send({ email: 'throttled@example.com', password: 'wrong-password' });
    }

    // The throttled attempt must be indistinguishable from an ordinary
    // wrong-password failure — no 429, no distinct message (spec 7: no
    // enumeration signal from throttling).
    const { token, cookies } = await getCsrfTokenAndCookies();
    const ordinaryFailure = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ email: 'nobody-else@example.com', password: 'whatever123' });

    expect(lastResponse!.status).toBe(401);
    expect(omitTimestamp(lastResponse!.body)).toEqual(
      omitTimestamp(ordinaryFailure.body),
    );
  });
});

function omitTimestamp(body: unknown): unknown {
  const { timestamp, ...rest } = body as { timestamp: string };
  void timestamp;
  return rest;
}

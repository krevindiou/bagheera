import { Controller, Get, Req, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { and, eq, sql } from 'drizzle-orm';
import type { Request } from 'express';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { buildActivationToken } from '../members/activation-token';
import { buildResetToken } from '../auth/reset-token';
import {
  connectIntegrationDb,
  IntegrationDb,
} from '../db/test-utils/integration-db';
import { DbModule } from '../db/db.module';
import { member, securityEvent } from '../db/schema';
import { EmailModule } from '../email/email.module';
import { EMAIL_PROVIDER } from '../email/email.constants';
import type { EmailProvider } from '../email/email-message';
import { MembersModule } from '../members/members.module';
import { HashService } from './hash.service';
import { CryptoService } from './crypto.service';
import { SecurityModule } from './security.module';
import { SessionModule } from '../session/session.module';

class FakeEmailProvider implements EmailProvider {
  send(): Promise<void> {
    return Promise.resolve();
  }
}

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

describe('security event audit logging (integration)', () => {
  let app: NestExpressApplication;
  let ctx: IntegrationDb;
  let hash: HashService;
  let crypto: CryptoService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DbModule,
        SecurityModule,
        SessionModule,
        EmailModule,
        AuthModule,
        MembersModule,
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
    crypto = moduleRef.get(CryptoService);
    ctx = connectIntegrationDb();
  });

  afterAll(async () => {
    await ctx.pool.end();
    await app.close();
  });

  beforeEach(async () => {
    await ctx.db.execute(
      sql`truncate table ${securityEvent}, ${member} restart identity cascade`,
    );
  });

  async function getCsrfTokenAndCookies(
    existingCookies: string[] = [],
  ): Promise<{ token: string; cookies: string[] }> {
    const res = await request(app.getHttpServer())
      .get('/__test-csrf/token')
      .set('Cookie', existingCookies)
      .set('X-Forwarded-Proto', 'https')
      .expect(200);
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const newCookies = setCookie.map(cookiePair);
    const merged = [
      ...existingCookies.filter(
        (c) => !newCookies.some((n) => n.split('=')[0] === c.split('=')[0]),
      ),
      ...newCookies,
    ];
    return {
      token: (res.body as { csrfToken: string }).csrfToken,
      cookies: merged,
    };
  }

  async function postWithCsrf(
    path: string,
    body: object,
    existingCookies: string[] = [],
  ) {
    const { token, cookies } = await getCsrfTokenAndCookies(existingCookies);
    const res = await request(app.getHttpServer())
      .post(path)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send(body);
    const setCookie = res.headers['set-cookie'] as unknown as
      string[] | undefined;
    const newCookies = setCookie?.map(cookiePair) ?? [];
    const mergedCookies = [
      ...cookies.filter(
        (c) => !newCookies.some((n) => n.split('=')[0] === c.split('=')[0]),
      ),
      ...newCookies,
    ];
    return { res, cookies: mergedCookies };
  }

  async function createMember(email: string, password: string, active = true) {
    const passwordHash = await hash.hash(password);
    const [row] = await ctx.db
      .insert(member)
      .values({ email, password: passwordHash, country: 'FR', active })
      .returning();
    return row;
  }

  async function eventsFor(eventType: string, memberId?: number) {
    return ctx.db
      .select()
      .from(securityEvent)
      .where(
        memberId === undefined
          ? eq(securityEvent.eventType, eventType as never)
          : and(
              eq(securityEvent.eventType, eventType as never),
              eq(securityEvent.memberId, memberId),
            ),
      );
  }

  it('records sign_in_success', async () => {
    const row = await createMember('success@example.com', 'correct-horse');
    const { res } = await postWithCsrf('/auth/sign-in', {
      email: 'success@example.com',
      password: 'correct-horse',
    });
    expect(res.status).toBe(200);

    const events = await eventsFor('sign_in_success', row.id);
    expect(events).toHaveLength(1);
  });

  it('records sign_in_failure', async () => {
    const row = await createMember('failure@example.com', 'correct-horse');
    const { res } = await postWithCsrf('/auth/sign-in', {
      email: 'failure@example.com',
      password: 'wrong-password',
    });
    expect(res.status).toBe(401);

    const events = await eventsFor('sign_in_failure', row.id);
    expect(events).toHaveLength(1);
  });

  it('records sign_in_throttled', async () => {
    await createMember('throttle@example.com', 'correct-horse');

    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      const { res } = await postWithCsrf('/auth/sign-in', {
        email: 'throttle@example.com',
        password: 'wrong-password',
      });
      lastStatus = res.status;
    }
    // Throttled attempts are rewritten to the same generic 401 an ordinary
    // wrong-password failure returns (no enumeration signal), but the
    // throttle is still audited server-side.
    expect(lastStatus).toBe(401);

    const events = await eventsFor('sign_in_throttled');
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('records password_changed (signed-in flow)', async () => {
    const row = await createMember('change@example.com', 'old-password');
    const { cookies } = await postWithCsrf('/auth/sign-in', {
      email: 'change@example.com',
      password: 'old-password',
    });

    const { res } = await postWithCsrf(
      '/auth/change-password',
      {
        currentPassword: 'old-password',
        newPassword: 'new-password',
        newPasswordConfirmation: 'new-password',
      },
      cookies,
    );
    expect(res.status).toBe(200);

    const events = await eventsFor('password_changed', row.id);
    expect(events).toHaveLength(1);
  });

  it('records password_recovery_completed (recovery flow)', async () => {
    const row = await createMember('recover@example.com', 'old-password');
    const token = buildResetToken(
      crypto,
      row.email,
      row.passwordResetTokenVersion,
    );

    const { res } = await postWithCsrf('/auth/password-recovery/reset', {
      key: token,
      password: 'new-password',
      passwordConfirmation: 'new-password',
    });
    expect(res.status).toBe(200);

    const events = await eventsFor('password_recovery_completed', row.id);
    expect(events).toHaveLength(1);
  });

  it('records password_recovery_requested', async () => {
    const row = await createMember('requested@example.com', 'old-password');
    const { res } = await postWithCsrf('/auth/password-recovery', {
      email: 'requested@example.com',
    });
    expect(res.status).toBe(200);

    const events = await eventsFor('password_recovery_requested', row.id);
    expect(events).toHaveLength(1);
  });

  it('records email_changed', async () => {
    const row = await createMember('email1@example.com', 'correct-horse');
    const { cookies } = await postWithCsrf('/auth/sign-in', {
      email: 'email1@example.com',
      password: 'correct-horse',
    });

    const { res } = await postWithCsrf(
      '/members/profile',
      { email: 'email1-new@example.com', currentPassword: 'correct-horse' },
      cookies,
    );
    expect(res.status).toBe(200);

    const events = await eventsFor('email_changed', row.id);
    expect(events).toHaveLength(1);
  });

  it('records activation_issued on registration', async () => {
    const { res } = await postWithCsrf('/members/register', {
      email: 'newreg@example.com',
      country: 'FR',
      password: 'correct-horse',
      passwordConfirmation: 'correct-horse',
    });
    expect(res.status).toBe(201);

    const [row] = await ctx.db
      .select()
      .from(member)
      .where(eq(member.email, 'newreg@example.com'));
    const events = await eventsFor('activation_issued', row.id);
    expect(events).toHaveLength(1);
  });

  it('records activation_used', async () => {
    const row = await createMember(
      'activate@example.com',
      'correct-horse',
      false,
    );
    const token = buildActivationToken(
      crypto,
      row.email,
      row.activationTokenVersion,
    );

    const { res } = await postWithCsrf('/members/activate', { key: token });
    expect(res.status).toBe(200);

    const events = await eventsFor('activation_used', row.id);
    expect(events).toHaveLength(1);
  });
});

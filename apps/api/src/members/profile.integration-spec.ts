import { Controller, Get, Req, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import { sql } from 'drizzle-orm';
import type { Request } from 'express';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import {
  connectIntegrationDb,
  IntegrationDb,
} from '../db/test-utils/integration-db';
import { DbModule } from '../db/db.module';
import { member } from '../db/schema';
import { EmailModule } from '../email/email.module';
import { EMAIL_PROVIDER, EMAIL_QUEUE } from '../email/email.constants';
import type { EmailMessage, EmailProvider } from '../email/email-message';
import { HashService } from '../security/hash.service';
import { SecurityModule } from '../security/security.module';
import { SessionModule } from '../session/session.module';
import { MembersModule } from './members.module';
import { Public } from '../session/public.decorator';

class FakeEmailProvider implements EmailProvider {
  send(): Promise<void> {
    return Promise.resolve();
  }
}

// Test-only controller — mints a CSRF token/cookie pair; never shipped.
@Public()
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

describe('profile (integration)', () => {
  let app: NestExpressApplication;
  let ctx: IntegrationDb;
  let hash: HashService;
  let emailQueue: Queue<EmailMessage>;

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
    emailQueue = moduleRef.get<Queue<EmailMessage>>(EMAIL_QUEUE);
    ctx = connectIntegrationDb();
  });

  afterAll(async () => {
    await ctx.pool.end();
    await app.close();
  });

  beforeEach(async () => {
    await emailQueue.drain();
    await emailQueue.clean(0, 1000, 'completed');
    await ctx.db.execute(
      sql`truncate table ${member} restart identity cascade`,
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

  async function signInAndGetSession(email: string, password: string) {
    const { token, cookies } = await getCsrfTokenAndCookies();
    const res = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ email, password })
      .expect(200);

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const newCookies = setCookie.map(cookiePair);
    return [
      ...cookies.filter(
        (c) => !newCookies.some((n) => n.split('=')[0] === c.split('=')[0]),
      ),
      ...newCookies,
    ];
  }

  async function createMember(email: string, password: string) {
    const passwordHash = await hash.hash(password);
    const [row] = await ctx.db
      .insert(member)
      .values({ email, password: passwordHash, country: 'FR', active: true })
      .returning();
    return row;
  }

  it('rejects the wrong current password and makes no change', async () => {
    const row = await createMember('profile1@example.com', 'correct-horse');
    const authCookies = await signInAndGetSession(
      'profile1@example.com',
      'correct-horse',
    );
    const { token, cookies } = await getCsrfTokenAndCookies(authCookies);

    const res = await request(app.getHttpServer())
      .post('/members/profile')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ email: 'newaddress@example.com', currentPassword: 'wrong' });

    expect(res.status).toBe(400);
    const [unchanged] = await ctx.db
      .select()
      .from(member)
      .where(sql`${member.id} = ${row.id}`);
    expect(unchanged.email).toBe(row.email);
  });

  it('updates the email, requires no re-activation, and notifies the previous address', async () => {
    const row = await createMember('profile2@example.com', 'correct-horse');
    const authCookies = await signInAndGetSession(
      'profile2@example.com',
      'correct-horse',
    );
    const { token, cookies } = await getCsrfTokenAndCookies(authCookies);

    const res = await request(app.getHttpServer())
      .post('/members/profile')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        email: 'profile2-new@example.com',
        currentPassword: 'correct-horse',
      });

    expect(res.status).toBe(200);

    const [updated] = await ctx.db
      .select()
      .from(member)
      .where(sql`${member.id} = ${row.id}`);
    expect(updated.email).toBe('profile2-new@example.com');
    expect(updated.active).toBe(true);

    const jobs = await emailQueue.getJobs(['waiting', 'active', 'completed']);
    const notice = jobs.filter(
      (j) => j.data.subject === 'Bagheera email address changed',
    );
    expect(notice).toHaveLength(1);
    expect(notice[0].data.to).toBe('profile2@example.com');
  });

  it('enforces email uniqueness', async () => {
    await createMember('taken@example.com', 'irrelevant');
    const row = await createMember('profile3@example.com', 'correct-horse');
    const authCookies = await signInAndGetSession(
      'profile3@example.com',
      'correct-horse',
    );
    const { token, cookies } = await getCsrfTokenAndCookies(authCookies);

    const res = await request(app.getHttpServer())
      .post('/members/profile')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ email: 'Taken@Example.com', currentPassword: 'correct-horse' });

    expect(res.status).toBe(400);
    const [unchanged] = await ctx.db
      .select()
      .from(member)
      .where(sql`${member.id} = ${row.id}`);
    expect(unchanged.email).toBe(row.email);
  });
});

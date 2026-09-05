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
import { CryptoService } from '../security/crypto.service';
import { HashService } from '../security/hash.service';
import { SecurityModule } from '../security/security.module';
import { SessionModule } from '../session/session.module';
import { buildEmailChangeToken } from './email-change-token';
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
  let crypto: CryptoService;
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
    crypto = moduleRef.get(CryptoService);
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

  it('requests an email change: leaves the address unchanged and emails a confirmation link to the new address', async () => {
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

    // Unchanged until the new address's owner confirms it.
    const [pending] = await ctx.db
      .select()
      .from(member)
      .where(sql`${member.id} = ${row.id}`);
    expect(pending.email).toBe('profile2@example.com');
    expect(pending.pendingEmail).toBe('profile2-new@example.com');

    const jobs = await emailQueue.getJobs(['waiting', 'active', 'completed']);
    const confirmation = jobs.filter(
      (j) => j.data.subject === 'Confirm your new Bagheera email address',
    );
    expect(confirmation).toHaveLength(1);
    expect(confirmation[0].data.to).toBe('profile2-new@example.com');
    // Not sent yet — only once the change is actually confirmed.
    const notice = jobs.filter(
      (j) => j.data.subject === 'Bagheera email address changed',
    );
    expect(notice).toHaveLength(0);
  });

  it('confirms a pending email change: updates the address, requires no re-activation, and notifies the previous address', async () => {
    const row = await createMember('profile2b@example.com', 'correct-horse');
    const authCookies = await signInAndGetSession(
      'profile2b@example.com',
      'correct-horse',
    );
    const { token, cookies } = await getCsrfTokenAndCookies(authCookies);
    await request(app.getHttpServer())
      .post('/members/profile')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        email: 'profile2b-new@example.com',
        currentPassword: 'correct-horse',
      })
      .expect(200);

    const [pending] = await ctx.db
      .select()
      .from(member)
      .where(sql`${member.id} = ${row.id}`);
    const confirmToken = buildEmailChangeToken(
      crypto,
      row.id,
      pending.pendingEmail!,
      pending.emailChangeTokenVersion,
    );

    // Reached from the emailed link, not the signed-in session above — a
    // fresh, unauthenticated CSRF pair, same as a brand-new browser tab.
    const confirmCsrf = await getCsrfTokenAndCookies();
    const res = await request(app.getHttpServer())
      .post('/members/profile/confirm-email-change')
      .set('Cookie', confirmCsrf.cookies)
      .set('x-csrf-token', confirmCsrf.token)
      .set('X-Forwarded-Proto', 'https')
      .send({ key: confirmToken });

    expect(res.status).toBe(200);

    const [updated] = await ctx.db
      .select()
      .from(member)
      .where(sql`${member.id} = ${row.id}`);
    expect(updated.email).toBe('profile2b-new@example.com');
    expect(updated.pendingEmail).toBeNull();
    expect(updated.active).toBe(true);

    const jobs = await emailQueue.getJobs(['waiting', 'active', 'completed']);
    const notice = jobs.filter(
      (j) => j.data.subject === 'Bagheera email address changed',
    );
    expect(notice).toHaveLength(1);
    expect(notice[0].data.to).toBe('profile2b@example.com');
  });

  it('rejects a confirmation link superseded by a later change request', async () => {
    const row = await createMember('profile2c@example.com', 'correct-horse');
    const authCookies = await signInAndGetSession(
      'profile2c@example.com',
      'correct-horse',
    );

    async function requestChange(email: string) {
      const { token, cookies } = await getCsrfTokenAndCookies(authCookies);
      await request(app.getHttpServer())
        .post('/members/profile')
        .set('Cookie', cookies)
        .set('x-csrf-token', token)
        .set('X-Forwarded-Proto', 'https')
        .send({ email, currentPassword: 'correct-horse' })
        .expect(200);
    }

    await requestChange('profile2c-first@example.com');
    const [afterFirst] = await ctx.db
      .select()
      .from(member)
      .where(sql`${member.id} = ${row.id}`);
    const staleToken = buildEmailChangeToken(
      crypto,
      row.id,
      afterFirst.pendingEmail!,
      afterFirst.emailChangeTokenVersion,
    );

    await requestChange('profile2c-second@example.com');

    const confirmCsrf = await getCsrfTokenAndCookies();
    const res = await request(app.getHttpServer())
      .post('/members/profile/confirm-email-change')
      .set('Cookie', confirmCsrf.cookies)
      .set('x-csrf-token', confirmCsrf.token)
      .set('X-Forwarded-Proto', 'https')
      .send({ key: staleToken });

    expect(res.status).toBe(400);
    const [unchanged] = await ctx.db
      .select()
      .from(member)
      .where(sql`${member.id} = ${row.id}`);
    expect(unchanged.email).toBe('profile2c@example.com');
    expect(unchanged.pendingEmail).toBe('profile2c-second@example.com');
  });

  it('rejects a malformed confirmation key', async () => {
    const { token, cookies } = await getCsrfTokenAndCookies();
    const res = await request(app.getHttpServer())
      .post('/members/profile/confirm-email-change')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ key: 'not-a-real-token' });

    expect(res.status).toBe(400);
  });

  it('silently no-ops for an email already taken by another member (no enumeration)', async () => {
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

    // Same 200/generic response as a genuine request — the caller can't
    // distinguish this from success.
    expect(res.status).toBe(200);
    const [unchanged] = await ctx.db
      .select()
      .from(member)
      .where(sql`${member.id} = ${row.id}`);
    expect(unchanged.email).toBe(row.email);
    expect(unchanged.pendingEmail).toBeNull();
    const jobs = await emailQueue.getJobs(['waiting', 'active', 'completed']);
    expect(jobs).toHaveLength(0); // no confirmation email sent
  });
});

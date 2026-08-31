import { Controller, Get, Req, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import { sql } from 'drizzle-orm';
import type { Request } from 'express';
import request from 'supertest';
import { createClient, type RedisClientType } from 'redis';
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
import { CryptoService } from '../security/crypto.service';
import { SessionModule } from '../session/session.module';
import { AuthModule } from './auth.module';
import { buildResetToken } from './reset-token';
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

describe('password recovery (integration)', () => {
  let app: NestExpressApplication;
  let ctx: IntegrationDb;
  let hash: HashService;
  let crypto: CryptoService;
  let emailQueue: Queue<EmailMessage>;
  let redis: RedisClientType;

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
    crypto = moduleRef.get(CryptoService);
    emailQueue = moduleRef.get<Queue<EmailMessage>>(EMAIL_QUEUE);
    ctx = connectIntegrationDb();

    redis = createClient({ url: process.env.VALKEY_URL });
    await redis.connect();
  });

  afterAll(async () => {
    await redis.quit();
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

  async function createMember(email: string, password: string) {
    const passwordHash = await hash.hash(password);
    const [row] = await ctx.db
      .insert(member)
      .values({ email, password: passwordHash, country: 'FR', active: true })
      .returning();
    return row;
  }

  async function postWithCsrf(path: string, body: object) {
    const tokenRes = await request(app.getHttpServer())
      .get('/__test-csrf/token')
      .set('X-Forwarded-Proto', 'https')
      .expect(200);
    const cookies = (tokenRes.headers['set-cookie'] as unknown as string[]).map(
      cookiePair,
    );
    const token = (tokenRes.body as { csrfToken: string }).csrfToken;

    return request(app.getHttpServer())
      .post(path)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send(body);
  }

  it('returns the identical message whether or not the email matches a member', async () => {
    await createMember('exists@example.com', 'correct-horse');

    const matched = await postWithCsrf('/auth/password-recovery', {
      email: 'exists@example.com',
    });
    const unmatched = await postWithCsrf('/auth/password-recovery', {
      email: 'nobody@example.com',
    });

    expect(matched.status).toBe(unmatched.status);
    expect(matched.body).toEqual(unmatched.body);
  });

  it('sends the reset email only for a matching member', async () => {
    await createMember('exists@example.com', 'correct-horse');

    await postWithCsrf('/auth/password-recovery', {
      email: 'exists@example.com',
    });
    await postWithCsrf('/auth/password-recovery', {
      email: 'nobody@example.com',
    });

    const jobs = await emailQueue.getJobs(['waiting', 'active', 'completed']);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].data.to).toBe('exists@example.com');
    expect(jobs[0].data.subject).toBe('Bagheera change password');
  });

  it('updates the password, invalidates the key, and terminates sessions on a valid submit', async () => {
    const row = await createMember('reset@example.com', 'old-password');
    await redis.set('sess:some-session', JSON.stringify({ memberId: row.id }));

    const token = buildResetToken(
      crypto,
      row.email,
      row.passwordResetTokenVersion,
    );
    const res = await postWithCsrf('/auth/password-recovery/reset', {
      key: token,
      password: 'new-password',
      passwordConfirmation: 'new-password',
    });

    expect(res.status).toBe(200);

    const [updated] = await ctx.db
      .select()
      .from(member)
      .where(sql`${member.id} = ${row.id}`);
    expect(updated.password).not.toBe(row.password);
    expect(await hash.verify(updated.password, 'new-password')).toBe(true);
    expect(updated.passwordResetTokenVersion).toBe(
      row.passwordResetTokenVersion + 1,
    );

    expect(await redis.exists('sess:some-session')).toBe(0);

    const jobs = await emailQueue.getJobs(['waiting', 'active', 'completed']);
    const notice = jobs.filter(
      (j) => j.data.subject === 'Bagheera password changed',
    );
    expect(notice).toHaveLength(1);
  });

  it('rejects mismatched new passwords', async () => {
    const row = await createMember('mismatch@example.com', 'old-password');
    const token = buildResetToken(
      crypto,
      row.email,
      row.passwordResetTokenVersion,
    );

    const res = await postWithCsrf('/auth/password-recovery/reset', {
      key: token,
      password: 'new-password',
      passwordConfirmation: 'something-else',
    });

    expect(res.status).toBe(400);
    const [unchanged] = await ctx.db
      .select()
      .from(member)
      .where(sql`${member.id} = ${row.id}`);
    expect(unchanged.password).toBe(row.password);
  });

  it('rejects an expired key', async () => {
    const row = await createMember('expired@example.com', 'old-password');
    const expiredToken = crypto.encrypt(
      JSON.stringify({
        type: 'reset',
        email: row.email,
        version: row.passwordResetTokenVersion,
        exp: Date.now() - 1000,
      }),
    );

    const res = await postWithCsrf('/auth/password-recovery/reset', {
      key: expiredToken,
      password: 'new-password',
      passwordConfirmation: 'new-password',
    });

    expect(res.status).toBe(400);
  });

  it('rejects a reused (already-invalidated) key', async () => {
    const row = await createMember('reused@example.com', 'old-password');
    const token = buildResetToken(
      crypto,
      row.email,
      row.passwordResetTokenVersion,
    );

    const first = await postWithCsrf('/auth/password-recovery/reset', {
      key: token,
      password: 'new-password',
      passwordConfirmation: 'new-password',
    });
    expect(first.status).toBe(200);

    const second = await postWithCsrf('/auth/password-recovery/reset', {
      key: token,
      password: 'another-password',
      passwordConfirmation: 'another-password',
    });
    expect(second.status).toBe(400);
  });

  it('rejects a key for an unmatched email', async () => {
    const token = buildResetToken(crypto, 'nobody@example.com', 0);

    const res = await postWithCsrf('/auth/password-recovery/reset', {
      key: token,
      password: 'new-password',
      passwordConfirmation: 'new-password',
    });

    expect(res.status).toBe(400);
  });
});

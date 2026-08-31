import { Controller, Get, Req, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { eq, sql } from 'drizzle-orm';
import type { Request } from 'express';
import request from 'supertest';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthModule } from '../auth/auth.module';
import { BanksModule } from '../banks/banks.module';
import { DbModule } from '../db/db.module';
import {
  account,
  bank,
  member,
  report,
  reportAccount,
  securityEvent,
} from '../db/schema';
import {
  connectIntegrationDb,
  IntegrationDb,
} from '../db/test-utils/integration-db';
import { EMAIL_PROVIDER } from '../email/email.constants';
import type { EmailProvider } from '../email/email-message';
import { EmailModule } from '../email/email.module';
import { HashService } from '../security/hash.service';
import { SecurityModule } from '../security/security.module';
import { SessionModule } from '../session/session.module';
import { ReportsModule } from './reports.module';
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

describe('report batch actions (integration)', () => {
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
        BanksModule,
        AccountsModule,
        ReportsModule,
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
      sql`truncate table ${securityEvent} restart identity cascade`,
    );
    await ctx.db.execute(
      sql`truncate table ${reportAccount}, ${report}, ${member} restart identity cascade`,
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

  async function authedRequest(email: string, password: string) {
    const authCookies = await signInAndGetSession(email, password);
    const { token, cookies } = await getCsrfTokenAndCookies(authCookies);
    return { token, cookies };
  }

  async function insertReport(memberId: number, title: string) {
    const [row] = await ctx.db
      .insert(report)
      .values({ memberId, type: 'sum', title, periodGrouping: 'month' })
      .returning();
    return row;
  }

  it('deletes only owned ids, silently skips foreign/nonexistent, and writes an audit event', async () => {
    const owner = await createMember('rbatch1@example.com', 'password1');
    const other = await createMember('rbatch1-other@example.com', 'password1');

    const owned = await insertReport(owner.id, 'Mine');
    const foreign = await insertReport(other.id, 'Not mine');
    const nonexistentId = 999999;

    const { token, cookies } = await authedRequest(
      'rbatch1@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/reports/batch/delete')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ ids: [owned.id, foreign.id, nonexistentId] });

    expect(res.status).toBe(200);
    expect((res.body as { deletedCount: number }).deletedCount).toBe(1);

    const remaining = await ctx.db.select({ id: report.id }).from(report);
    expect(remaining.map((r) => r.id)).toEqual([foreign.id]);

    const [event] = await ctx.db
      .select()
      .from(securityEvent)
      .where(sql`${securityEvent.eventType} = 'report_batch_deleted'`);
    expect(event).toBeDefined();
    expect(event.memberId).toBe(owner.id);
  });

  it('purges the linked account selection along with the report', async () => {
    const owner = await createMember('rbatch2@example.com', 'password1');
    const owned = await insertReport(owner.id, 'Mine');
    const [ownerBank] = await ctx.db
      .insert(bank)
      .values({ memberId: owner.id, name: 'Bank' })
      .returning();
    const [acc] = await ctx.db
      .insert(account)
      .values({ bankId: ownerBank.id, name: 'Checking', currency: 'USD' })
      .returning();
    await ctx.db
      .insert(reportAccount)
      .values({ reportId: owned.id, accountId: acc.id });

    const { token, cookies } = await authedRequest(
      'rbatch2@example.com',
      'password1',
    );
    const res = await request(app.getHttpServer())
      .post('/reports/batch/delete')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ ids: [owned.id] });

    expect(res.status).toBe(200);
    expect((res.body as { deletedCount: number }).deletedCount).toBe(1);

    const links = await ctx.db
      .select()
      .from(reportAccount)
      .where(eq(reportAccount.reportId, owned.id));
    expect(links).toHaveLength(0);
  });

  it('does nothing and still writes an audit event when every id is foreign', async () => {
    const other = await createMember('rbatch3-other@example.com', 'password1');
    await createMember('rbatch3@example.com', 'password1');
    const foreign = await insertReport(other.id, 'Not mine');

    const { token, cookies } = await authedRequest(
      'rbatch3@example.com',
      'password1',
    );
    const res = await request(app.getHttpServer())
      .post('/reports/batch/delete')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ ids: [foreign.id] });

    expect(res.status).toBe(200);
    expect((res.body as { deletedCount: number }).deletedCount).toBe(0);

    const [stillThere] = await ctx.db
      .select()
      .from(report)
      .where(eq(report.id, foreign.id));
    expect(stillThere).toBeDefined();

    const [event] = await ctx.db
      .select()
      .from(securityEvent)
      .where(sql`${securityEvent.eventType} = 'report_batch_deleted'`);
    expect(event).toBeDefined();
  });
});

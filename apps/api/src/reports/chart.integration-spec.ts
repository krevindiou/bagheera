import { Controller, Get, Req, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import type { Request } from 'express';
import request from 'supertest';
import {
  connectIntegrationDb,
  IntegrationDb,
} from '../db/test-utils/integration-db';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthModule } from '../auth/auth.module';
import { BanksModule } from '../banks/banks.module';
import { DbModule } from '../db/db.module';
import {
  account,
  bank,
  member,
  operation,
  report,
  reportAccount,
} from '../db/schema';
import { EMAIL_PROVIDER } from '../email/email.constants';
import type { EmailProvider } from '../email/email-message';
import { EmailModule } from '../email/email.module';
import { ReportsModule } from './reports.module';
import { HashService } from '../security/hash.service';
import { SecurityModule } from '../security/security.module';
import { SessionModule } from '../session/session.module';
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

describe('report chart (integration)', () => {
  let app: NestExpressApplication;
  let ctx: IntegrationDb;
  let hash: HashService;
  let bankCounter = 0;

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
      sql`truncate table ${operation}, ${reportAccount}, ${report}, ${account}, ${bank}, ${member} restart identity cascade`,
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
    const merged = [
      ...cookies.filter(
        (c) => !newCookies.some((n) => n.split('=')[0] === c.split('=')[0]),
      ),
      ...newCookies,
    ];
    return merged;
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

  async function createAccount(
    memberId: number,
    opts: { currency?: string; deleted?: boolean; bankDeleted?: boolean } = {},
  ) {
    const [ownerBank] = await ctx.db
      .insert(bank)
      .values({
        memberId,
        name: `Bank ${++bankCounter}`,
        deleted: opts.bankDeleted ?? false,
      })
      .returning();
    const [acc] = await ctx.db
      .insert(account)
      .values({
        bankId: ownerBank.id,
        name: 'Checking',
        currency: opts.currency ?? 'EUR',
        deleted: opts.deleted ?? false,
      })
      .returning();
    return acc;
  }

  async function createOperation(
    accountId: number,
    valueDate: string,
    opts: { debit?: number; credit?: number } = {},
  ) {
    await ctx.db.insert(operation).values({
      accountId,
      thirdParty: 'Grocery Store',
      debit: opts.debit ?? null,
      credit: opts.credit ?? null,
      paymentMethodId: 1,
      valueDate,
    });
  }

  async function fetchChart(id: number, cookies: string[]) {
    const res = await request(app.getHttpServer())
      .get(`/reports/${id}/chart`)
      .set('Cookie', cookies)
      .set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(200);
    return res.body as {
      hidden: boolean;
      axisBounds: { min: number; max: number } | null;
      series: {
        currency: string;
        credit: { period: string; value: number }[];
        debit: { period: string; value: number }[];
      }[];
    };
  }

  it('groups sum data by month, zero-filling gaps', async () => {
    const owner = await createMember('chart1@example.com', 'password1');
    const acc = await createAccount(owner.id);
    await createOperation(acc.id, '2026-01-15', { debit: 100_0000 });
    // February has no data — must be zero-filled.
    await createOperation(acc.id, '2026-03-10', { debit: 50_0000 });
    const [rpt] = await ctx.db
      .insert(report)
      .values({
        memberId: owner.id,
        type: 'sum',
        title: 'Monthly',
        periodGrouping: 'month',
      })
      .returning();
    const { cookies } = await authedRequest('chart1@example.com', 'password1');

    const body = await fetchChart(rpt.id, cookies);
    expect(body.hidden).toBe(false);
    expect(body.series).toHaveLength(1);
    const [series] = body.series;
    expect(series.currency).toBe('EUR');
    expect(series.debit).toEqual([
      { period: '2026-01-01', value: 100 },
      { period: '2026-02-01', value: 0 },
      { period: '2026-03-01', value: 50 },
    ]);
  });

  it('groups by quarter and by year', async () => {
    const owner = await createMember('chart2@example.com', 'password1');
    const acc = await createAccount(owner.id);
    await createOperation(acc.id, '2026-01-05', { credit: 200_0000 });
    await createOperation(acc.id, '2026-06-05', { credit: 300_0000 });
    const { cookies } = await authedRequest('chart2@example.com', 'password1');

    const [quarterly] = await ctx.db
      .insert(report)
      .values({
        memberId: owner.id,
        type: 'sum',
        title: 'Quarterly',
        periodGrouping: 'quarter',
      })
      .returning();
    const quarterlyBody = await fetchChart(quarterly.id, cookies);
    expect(quarterlyBody.series[0].credit).toEqual([
      { period: '2026-01-01', value: 200 },
      { period: '2026-04-01', value: 300 },
    ]);

    const [yearly] = await ctx.db
      .insert(report)
      .values({
        memberId: owner.id,
        type: 'sum',
        title: 'Yearly',
        periodGrouping: 'year',
      })
      .returning();
    const yearlyBody = await fetchChart(yearly.id, cookies);
    expect(yearlyBody.series[0].credit).toEqual([
      { period: '2026-01-01', value: 500 },
    ]);
  });

  it('aggregates "all" grouping into a single point at the start of the current year', async () => {
    const owner = await createMember('chart3@example.com', 'password1');
    const acc = await createAccount(owner.id);
    await createOperation(acc.id, '2020-01-05', { credit: 100_0000 });
    await createOperation(acc.id, '2026-06-05', { credit: 400_0000 });
    const [rpt] = await ctx.db
      .insert(report)
      .values({
        memberId: owner.id,
        type: 'sum',
        title: 'All time',
        periodGrouping: 'all',
      })
      .returning();
    const { cookies } = await authedRequest('chart3@example.com', 'password1');

    const body = await fetchChart(rpt.id, cookies);
    const currentYearStart = `${new Date().getUTCFullYear()}-01-01`;
    expect(body.series[0].credit).toEqual([
      { period: currentYearStart, value: 500 },
    ]);
  });

  it('computes an average per period for average reports', async () => {
    const owner = await createMember('chart4@example.com', 'password1');
    const acc = await createAccount(owner.id);
    await createOperation(acc.id, '2026-01-05', { debit: 100_0000 });
    await createOperation(acc.id, '2026-01-20', { debit: 300_0000 });
    const [rpt] = await ctx.db
      .insert(report)
      .values({
        memberId: owner.id,
        type: 'average',
        title: 'Average',
        periodGrouping: 'month',
      })
      .returning();
    const { cookies } = await authedRequest('chart4@example.com', 'password1');

    const body = await fetchChart(rpt.id, cookies);
    expect(body.series[0].debit).toEqual([
      { period: '2026-01-01', value: 200 },
    ]);
  });

  it('produces one series per currency present in the account set', async () => {
    const owner = await createMember('chart5@example.com', 'password1');
    const eurAcc = await createAccount(owner.id, { currency: 'EUR' });
    const usdAcc = await createAccount(owner.id, { currency: 'USD' });
    await createOperation(eurAcc.id, '2026-01-05', { debit: 100_0000 });
    await createOperation(usdAcc.id, '2026-01-05', { debit: 200_0000 });
    const [rpt] = await ctx.db
      .insert(report)
      .values({
        memberId: owner.id,
        type: 'sum',
        title: 'Multi-currency',
        periodGrouping: 'month',
      })
      .returning();
    const { cookies } = await authedRequest('chart5@example.com', 'password1');

    const body = await fetchChart(rpt.id, cookies);
    const currencies = body.series.map((s) => s.currency).sort();
    expect(currencies).toEqual(['EUR', 'USD']);
  });

  it('excludes deleted accounts and accounts of deleted banks even when explicitly selected', async () => {
    const owner = await createMember('chart6@example.com', 'password1');
    const acc = await createAccount(owner.id);
    const deletedAcc = await createAccount(owner.id, { deleted: true });
    const deletedBankAcc = await createAccount(owner.id, { bankDeleted: true });
    await createOperation(acc.id, '2026-01-05', { debit: 100_0000 });
    await createOperation(deletedAcc.id, '2026-01-05', { debit: 999_0000 });
    await createOperation(deletedBankAcc.id, '2026-01-05', { debit: 999_0000 });
    const [rpt] = await ctx.db
      .insert(report)
      .values({
        memberId: owner.id,
        type: 'sum',
        title: 'Excludes deleted',
        periodGrouping: 'month',
      })
      .returning();
    await ctx.db.insert(reportAccount).values([
      { reportId: rpt.id, accountId: acc.id },
      { reportId: rpt.id, accountId: deletedAcc.id },
      { reportId: rpt.id, accountId: deletedBankAcc.id },
    ]);
    const { cookies } = await authedRequest('chart6@example.com', 'password1');

    const body = await fetchChart(rpt.id, cookies);
    expect(body.series).toHaveLength(1);
    expect(body.series[0].debit).toEqual([
      { period: '2026-01-01', value: 100 },
    ]);
  });

  it('is hidden when the effective account set has no matching operations', async () => {
    const owner = await createMember('chart7@example.com', 'password1');
    await createAccount(owner.id);
    const [rpt] = await ctx.db
      .insert(report)
      .values({
        memberId: owner.id,
        type: 'sum',
        title: 'Empty',
        periodGrouping: 'month',
      })
      .returning();
    const { cookies } = await authedRequest('chart7@example.com', 'password1');

    const body = await fetchChart(rpt.id, cookies);
    expect(body.hidden).toBe(true);
    expect(body.series).toEqual([]);
  });

  it('is hidden when the effective account set is empty after exclusions', async () => {
    const owner = await createMember('chart8@example.com', 'password1');
    const deletedAcc = await createAccount(owner.id, { deleted: true });
    await createOperation(deletedAcc.id, '2026-01-05', { debit: 100_0000 });
    const [rpt] = await ctx.db
      .insert(report)
      .values({
        memberId: owner.id,
        type: 'sum',
        title: 'No accounts left',
        periodGrouping: 'month',
      })
      .returning();
    await ctx.db
      .insert(reportAccount)
      .values({ reportId: rpt.id, accountId: deletedAcc.id });
    const { cookies } = await authedRequest('chart8@example.com', 'password1');

    const body = await fetchChart(rpt.id, cookies);
    expect(body.hidden).toBe(true);
  });
});

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
import { DashboardModule } from './dashboard.module';
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
import { HashService } from '../security/hash.service';
import { SecurityModule } from '../security/security.module';
import { SessionModule } from '../session/session.module';
import { Public } from '../session/public.decorator';
import { MinorUnits } from '../common/money';

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

interface DashboardBody {
  onboarding: 'no-bank' | 'no-account' | null;
  totalBalances: { currency: string; amount: number }[];
  lastSalary: { amount: number; currency: string; valueDate: string } | null;
  lastBiggestExpense: {
    amount: number;
    currency: string;
    valueDate: string;
  } | null;
  accountsOverview: {
    id: number;
    name: string;
    accounts: { id: number; name: string; currency: string; balance: number }[];
  }[];
  homepageReports: { id: number; title: string; chart: unknown }[];
}

describe('dashboard (integration)', () => {
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
        DashboardModule,
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

  async function createBank(
    memberId: number,
    opts: { closed?: boolean; deleted?: boolean } = {},
  ) {
    const [row] = await ctx.db
      .insert(bank)
      .values({
        memberId,
        name: `Bank ${++bankCounter}`,
        closed: opts.closed ?? false,
        deleted: opts.deleted ?? false,
      })
      .returning();
    return row;
  }

  async function createAccount(
    bankId: number,
    opts: {
      currency?: string;
      closed?: boolean;
      deleted?: boolean;
      name?: string;
    } = {},
  ) {
    const [row] = await ctx.db
      .insert(account)
      .values({
        bankId,
        name: opts.name ?? 'Checking',
        currency: opts.currency ?? 'EUR',
        closed: opts.closed ?? false,
        deleted: opts.deleted ?? false,
      })
      .returning();
    return row;
  }

  async function createOperation(
    accountId: number,
    valueDate: string,
    opts: {
      debit?: number;
      credit?: number;
      categoryId?: number;
      schedulerId?: number | null;
    } = {},
  ) {
    await ctx.db.insert(operation).values({
      accountId,
      thirdParty: 'Grocery Store',
      // opts carries plain, already-minor-units literals from callers;
      // brand them here, the one spot that needs to satisfy Drizzle's typed column.
      debit: (opts.debit ?? null) as MinorUnits | null,
      credit: (opts.credit ?? null) as MinorUnits | null,
      categoryId: opts.categoryId,
      paymentMethodId: 1,
      valueDate,
    });
  }

  async function fetchDashboard(cookies: string[]): Promise<DashboardBody> {
    const res = await request(app.getHttpServer())
      .get('/dashboard')
      .set('Cookie', cookies)
      .set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(200);
    return res.body as DashboardBody;
  }

  it('shows the no-bank tip and empty sections when the member has no bank', async () => {
    await createMember('dash1@example.com', 'password1');
    const { cookies } = await authedRequest('dash1@example.com', 'password1');

    const body = await fetchDashboard(cookies);
    expect(body.onboarding).toBe('no-bank');
    expect(body.totalBalances).toEqual([]);
    expect(body.accountsOverview).toEqual([]);
  });

  it('shows the no-account tip when an active bank has no non-deleted account', async () => {
    const owner = await createMember('dash2@example.com', 'password1');
    await createBank(owner.id);
    const { cookies } = await authedRequest('dash2@example.com', 'password1');

    const body = await fetchDashboard(cookies);
    expect(body.onboarding).toBe('no-account');
  });

  it('shows no tip when every bank is closed and there is no account', async () => {
    const owner = await createMember('dash3@example.com', 'password1');
    await createBank(owner.id, { closed: true });
    const { cookies } = await authedRequest('dash3@example.com', 'password1');

    const body = await fetchDashboard(cookies);
    expect(body.onboarding).toBeNull();
  });

  it('sums total balance per currency including closed accounts, raw-integer ordered', async () => {
    const owner = await createMember('dash4@example.com', 'password1');
    const eurBank = await createBank(owner.id);
    const eurAcc = await createAccount(eurBank.id, { currency: 'EUR' });
    const eurAcc2 = await createAccount(eurBank.id, {
      currency: 'EUR',
      closed: true,
      name: 'Savings',
    });
    const usdAcc = await createAccount(eurBank.id, { currency: 'USD' });
    await createOperation(eurAcc.id, '2026-01-01', { credit: 100_0000 });
    await createOperation(eurAcc2.id, '2026-01-01', { credit: 50_0000 });
    await createOperation(usdAcc.id, '2026-01-01', { credit: 900_0000 });
    const { cookies } = await authedRequest('dash4@example.com', 'password1');

    const body = await fetchDashboard(cookies);
    expect(body.totalBalances).toEqual([
      { currency: 'USD', amount: 900 },
      { currency: 'EUR', amount: 150 },
    ]);
  });

  it('excludes closed accounts and closed banks from the accounts overview but keeps them in totals', async () => {
    const owner = await createMember('dash5@example.com', 'password1');
    const activeBank = await createBank(owner.id);
    const closedBank = await createBank(owner.id, { closed: true });
    const activeAcc = await createAccount(activeBank.id);
    const closedAcc = await createAccount(activeBank.id, { closed: true });
    const accInClosedBank = await createAccount(closedBank.id);
    await createOperation(activeAcc.id, '2026-01-01', { credit: 100_0000 });
    await createOperation(closedAcc.id, '2026-01-01', { credit: 50_0000 });
    await createOperation(accInClosedBank.id, '2026-01-01', {
      credit: 20_0000,
    });
    const { cookies } = await authedRequest('dash5@example.com', 'password1');

    const body = await fetchDashboard(cookies);
    expect(body.accountsOverview).toEqual([
      {
        id: activeBank.id,
        name: activeBank.name,
        accounts: [
          {
            id: activeAcc.id,
            name: activeAcc.name,
            currency: 'EUR',
            balance: 100,
          },
        ],
      },
    ]);
    expect(body.totalBalances).toEqual([{ currency: 'EUR', amount: 170 }]);
  });

  it('reports the last salary from the configured salary category, hidden when none exists', async () => {
    const owner = await createMember('dash6@example.com', 'password1');
    const b = await createBank(owner.id);
    const acc = await createAccount(b.id);
    const { cookies } = await authedRequest('dash6@example.com', 'password1');

    expect((await fetchDashboard(cookies)).lastSalary).toBeNull();

    await createOperation(acc.id, '2026-01-05', {
      credit: 2000_0000,
      categoryId: 1,
    });
    await createOperation(acc.id, '2026-02-05', {
      credit: 2100_0000,
      categoryId: 1,
    });

    const body = await fetchDashboard(cookies);
    expect(body.lastSalary).toMatchObject({
      amount: 2100,
      currency: 'EUR',
      valueDate: '2026-02-05',
    });
  });

  it('scopes last salary to fully active banks/accounts only', async () => {
    const owner = await createMember('dash7@example.com', 'password1');
    const closedBank = await createBank(owner.id, { closed: true });
    const acc = await createAccount(closedBank.id);
    await createOperation(acc.id, '2026-01-05', {
      credit: 2000_0000,
      categoryId: 1,
    });
    const { cookies } = await authedRequest('dash7@example.com', 'password1');

    const body = await fetchDashboard(cookies);
    expect(body.lastSalary).toBeNull();
  });

  it('reports the last biggest expense of the previous calendar month, excluding scheduler-generated operations', async () => {
    const owner = await createMember('dash8@example.com', 'password1');
    const b = await createBank(owner.id);
    const acc = await createAccount(b.id);

    const now = new Date();
    const prevMonthDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 10),
    )
      .toISOString()
      .slice(0, 10);
    const twoMonthsAgoDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 10),
    )
      .toISOString()
      .slice(0, 10);

    await createOperation(acc.id, prevMonthDate, { debit: 100_0000 });
    // Bigger, but outside the previous calendar month — excluded.
    await createOperation(acc.id, twoMonthsAgoDate, { debit: 999_0000 });
    const { cookies } = await authedRequest('dash8@example.com', 'password1');

    const body = await fetchDashboard(cookies);
    expect(body.lastBiggestExpense).toMatchObject({
      amount: 100,
      valueDate: prevMonthDate,
    });
  });

  it('picks the largest raw stored amount across currencies with no conversion', async () => {
    const owner = await createMember('dash9@example.com', 'password1');
    const b = await createBank(owner.id);
    const eurAcc = await createAccount(b.id, { currency: 'EUR' });
    const usdAcc = await createAccount(b.id, { currency: 'USD' });

    const now = new Date();
    const prevMonthDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 10),
    )
      .toISOString()
      .slice(0, 10);

    await createOperation(eurAcc.id, prevMonthDate, { debit: 100_0000 });
    await createOperation(usdAcc.id, prevMonthDate, { debit: 200_0000 });
    const { cookies } = await authedRequest('dash9@example.com', 'password1');

    const body = await fetchDashboard(cookies);
    expect(body.lastBiggestExpense).toMatchObject({
      amount: 200,
      currency: 'USD',
    });
  });

  it('lists non-hidden homepage report charts, omitting empty ones', async () => {
    const owner = await createMember('dash10@example.com', 'password1');
    const b = await createBank(owner.id);
    const acc = await createAccount(b.id);
    await createOperation(acc.id, '2026-01-05', { debit: 50_0000 });

    const [withData] = await ctx.db
      .insert(report)
      .values({
        memberId: owner.id,
        type: 'sum',
        title: 'Has data',
        periodGrouping: 'month',
        homepage: true,
      })
      .returning();
    await ctx.db.insert(report).values({
      memberId: owner.id,
      type: 'sum',
      title: 'Empty',
      periodGrouping: 'month',
      homepage: true,
      valueDateStart: '2099-01-01',
    });
    await ctx.db.insert(report).values({
      memberId: owner.id,
      type: 'sum',
      title: 'Not homepage',
      periodGrouping: 'month',
      homepage: false,
    });
    const { cookies } = await authedRequest('dash10@example.com', 'password1');

    const body = await fetchDashboard(cookies);
    expect(body.homepageReports).toHaveLength(1);
    expect(body.homepageReports[0]).toMatchObject({
      id: withData.id,
      title: 'Has data',
    });
  });
});

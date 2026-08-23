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
import { DbModule } from '../db/db.module';
import { account, bank, member, operation } from '../db/schema';
import { EmailModule } from '../email/email.module';
import { EMAIL_PROVIDER } from '../email/email.constants';
import type { EmailProvider } from '../email/email-message';
import { HashService } from '../security/hash.service';
import { SecurityModule } from '../security/security.module';
import { SessionModule } from '../session/session.module';
import { VALKEY_CLIENT } from '../session/session.constants';
import { AuthModule } from '../auth/auth.module';
import { BanksModule } from '../banks/banks.module';
import { AccountsModule } from '../accounts/accounts.module';
import { OperationsModule } from './operations.module';

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

describe('operations search (integration)', () => {
  let app: NestExpressApplication;
  let ctx: IntegrationDb;
  let hash: HashService;
  let valkey: {
    keys(pattern: string): Promise<string[]>;
    del(key: string): Promise<number>;
  };

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
        OperationsModule,
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
    valkey = moduleRef.get(VALKEY_CLIENT);
  });

  afterAll(async () => {
    await ctx.pool.end();
    await app.close();
  });

  beforeEach(async () => {
    const leftoverKeys = await valkey.keys('opsearch:*');
    await Promise.all(leftoverKeys.map((k) => valkey.del(k)));
    await ctx.db.execute(
      sql`truncate table ${operation} restart identity cascade`,
    );
    await ctx.db.execute(
      sql`truncate table ${account} restart identity cascade`,
    );
    await ctx.db.execute(sql`truncate table ${bank} restart identity cascade`);
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

  async function createOwnedAccount(email: string) {
    const owner = await createMember(email, 'password1');
    const [ownerBank] = await ctx.db
      .insert(bank)
      .values({ memberId: owner.id, name: `Bank ${email}` })
      .returning();
    const [acc] = await ctx.db
      .insert(account)
      .values({ bankId: ownerBank.id, name: 'Checking', currency: 'USD' })
      .returning();
    return { owner, bank: ownerBank, account: acc };
  }

  type OpOverrides = Partial<{
    thirdParty: string;
    categoryId: number;
    paymentMethodId: number;
    debit: number | null;
    credit: number | null;
    valueDate: string;
    notes: string;
    reconciled: boolean;
  }>;

  async function insertOperation(accountId: number, overrides: OpOverrides) {
    const [row] = await ctx.db
      .insert(operation)
      .values({
        accountId,
        thirdParty: overrides.thirdParty ?? 'Third Party',
        paymentMethodId: overrides.paymentMethodId ?? 1,
        categoryId: overrides.categoryId,
        debit: overrides.debit === undefined ? 100000 : overrides.debit,
        credit: overrides.credit,
        valueDate: overrides.valueDate ?? '2026-01-01',
        notes: overrides.notes ?? '',
        reconciled: overrides.reconciled ?? false,
      })
      .returning();
    return row;
  }

  async function seedFixtures(email: string) {
    const { account: acc } = await createOwnedAccount(email);
    const grocery = await insertOperation(acc.id, {
      thirdParty: 'Grocery Store',
      categoryId: 6, // Food (debit)
      paymentMethodId: 1,
      debit: 42_5000,
      credit: null,
      valueDate: '2026-01-10',
      notes: 'weekly shop',
      reconciled: true,
    });
    const salary = await insertOperation(acc.id, {
      thirdParty: 'Employer Inc',
      categoryId: 1, // Salary (credit)
      paymentMethodId: 7,
      debit: null,
      credit: 2000_0000,
      valueDate: '2026-01-05',
      notes: 'monthly pay',
      reconciled: false,
    });
    return { acc, grocery, salary };
  }

  it('filters by type', async () => {
    const { acc } = await seedFixtures('search1@example.com');
    const { token, cookies } = await authedRequest(
      'search1@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/operations/search')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ accountId: acc.id, type: 'credit' });

    expect(res.status).toBe(200);
    const body = res.body as { items: { thirdParty: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0].thirdParty).toBe('Employer Inc');
  });

  it('filters by third-party contains', async () => {
    const { acc } = await seedFixtures('search2@example.com');
    const { token, cookies } = await authedRequest(
      'search2@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/operations/search')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ accountId: acc.id, thirdParty: 'grocery' });

    expect(res.status).toBe(200);
    const body = res.body as { items: { thirdParty: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0].thirdParty).toBe('Grocery Store');
  });

  it('filters by category and payment-method multi-select', async () => {
    const { acc } = await seedFixtures('search3@example.com');
    const { token, cookies } = await authedRequest(
      'search3@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/operations/search')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ accountId: acc.id, categoryIds: [1, 6], paymentMethodIds: [7] });

    expect(res.status).toBe(200);
    const body = res.body as { items: { thirdParty: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0].thirdParty).toBe('Employer Inc');
  });

  it('filters by up to two amount comparators', async () => {
    const { acc } = await seedFixtures('search4@example.com');
    const { token, cookies } = await authedRequest(
      'search4@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/operations/search')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: acc.id,
        amountComparators: [
          { operator: 'gte', value: 40 },
          { operator: 'lte', value: 50 },
        ],
      });

    expect(res.status).toBe(200);
    const body = res.body as { items: { thirdParty: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0].thirdParty).toBe('Grocery Store');
  });

  it('filters by date range', async () => {
    const { acc } = await seedFixtures('search5@example.com');
    const { token, cookies } = await authedRequest(
      'search5@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/operations/search')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: acc.id,
        dateFrom: '2026-01-08',
        dateTo: '2026-01-31',
      });

    expect(res.status).toBe(200);
    const body = res.body as { items: { thirdParty: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0].thirdParty).toBe('Grocery Store');
  });

  it('filters by notes contains', async () => {
    const { acc } = await seedFixtures('search6@example.com');
    const { token, cookies } = await authedRequest(
      'search6@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/operations/search')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ accountId: acc.id, notes: 'monthly' });

    expect(res.status).toBe(200);
    const body = res.body as { items: { thirdParty: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0].thirdParty).toBe('Employer Inc');
  });

  it('rejects a third-party criterion over 64 characters and a notes criterion over 128', async () => {
    const { acc } = await seedFixtures('search6b@example.com');
    const { token, cookies } = await authedRequest(
      'search6b@example.com',
      'password1',
    );

    const tooLongThirdParty = await request(app.getHttpServer())
      .post('/operations/search')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ accountId: acc.id, thirdParty: 'x'.repeat(65) });
    expect(tooLongThirdParty.status).toBe(400);

    const { token: token2, cookies: cookies2 } =
      await getCsrfTokenAndCookies(cookies);
    const tooLongNotes = await request(app.getHttpServer())
      .post('/operations/search')
      .set('Cookie', cookies2)
      .set('x-csrf-token', token2)
      .set('X-Forwarded-Proto', 'https')
      .send({ accountId: acc.id, notes: 'x'.repeat(129) });
    expect(tooLongNotes.status).toBe(400);
  });

  it('filters by reconciled tri-state', async () => {
    const { acc } = await seedFixtures('search7@example.com');
    const { token, cookies } = await authedRequest(
      'search7@example.com',
      'password1',
    );

    const reconciledTrue = await request(app.getHttpServer())
      .post('/operations/search')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ accountId: acc.id, reconciled: true });
    expect((reconciledTrue.body as { items: unknown[] }).items).toHaveLength(1);

    const { token: token2, cookies: cookies2 } =
      await getCsrfTokenAndCookies(cookies);
    const reconciledFalse = await request(app.getHttpServer())
      .post('/operations/search')
      .set('Cookie', cookies2)
      .set('x-csrf-token', token2)
      .set('X-Forwarded-Proto', 'https')
      .send({ accountId: acc.id, reconciled: false });
    expect((reconciledFalse.body as { items: unknown[] }).items).toHaveLength(
      1,
    );

    const { token: token3, cookies: cookies3 } =
      await getCsrfTokenAndCookies(cookies);
    const either = await request(app.getHttpServer())
      .post('/operations/search')
      .set('Cookie', cookies3)
      .set('x-csrf-token', token3)
      .set('X-Forwarded-Proto', 'https')
      .send({ accountId: acc.id });
    expect((either.body as { items: unknown[] }).items).toHaveLength(2);
  });

  it('AND-combines multiple criteria', async () => {
    const { acc } = await seedFixtures('search8@example.com');
    const { token, cookies } = await authedRequest(
      'search8@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/operations/search')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ accountId: acc.id, type: 'debit', reconciled: true });
    expect((res.body as { items: unknown[] }).items).toHaveLength(1);

    const { token: token2, cookies: cookies2 } =
      await getCsrfTokenAndCookies(cookies);
    const noMatch = await request(app.getHttpServer())
      .post('/operations/search')
      .set('Cookie', cookies2)
      .set('x-csrf-token', token2)
      .set('X-Forwarded-Proto', 'https')
      .send({ accountId: acc.id, type: 'debit', reconciled: false });
    expect((noMatch.body as { items: unknown[] }).items).toHaveLength(0);
  });

  it('remembers the search per member+account and clears it explicitly', async () => {
    const { acc } = await seedFixtures('search9@example.com');
    const { token, cookies } = await authedRequest(
      'search9@example.com',
      'password1',
    );

    await request(app.getHttpServer())
      .post('/operations/search')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ accountId: acc.id, type: 'credit' })
      .expect(200);

    const recalled = await request(app.getHttpServer())
      .get(`/operations/search?accountId=${acc.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');
    expect(recalled.status).toBe(200);
    const recalledBody = recalled.body as { items: { thirdParty: string }[] };
    expect(recalledBody.items).toHaveLength(1);
    expect(recalledBody.items[0].thirdParty).toBe('Employer Inc');

    const { token: token2, cookies: cookies2 } =
      await getCsrfTokenAndCookies(cookies);
    await request(app.getHttpServer())
      .delete(`/operations/search?accountId=${acc.id}`)
      .set('Cookie', cookies2)
      .set('x-csrf-token', token2)
      .set('X-Forwarded-Proto', 'https')
      .expect(200);

    const afterClear = await request(app.getHttpServer())
      .get(`/operations/search?accountId=${acc.id}`)
      .set('Cookie', cookies2)
      .set('x-csrf-token', token2)
      .set('X-Forwarded-Proto', 'https');
    expect(afterClear.status).toBe(200);
    expect((afterClear.body as { items: unknown[] }).items).toHaveLength(2);
  });

  it('returns not found for a non-owner searching a foreign account', async () => {
    const { acc } = await seedFixtures('search10@example.com');
    await createMember('intruder10@example.com', 'password1');
    const { token, cookies } = await authedRequest(
      'intruder10@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/operations/search')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ accountId: acc.id });

    expect(res.status).toBe(404);
  });
});

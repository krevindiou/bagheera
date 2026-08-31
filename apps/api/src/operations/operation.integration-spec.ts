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
import { AuthModule } from '../auth/auth.module';
import { BanksModule } from '../banks/banks.module';
import { AccountsModule } from '../accounts/accounts.module';
import { OperationsModule } from './operations.module';
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

describe('operations (integration)', () => {
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
  });

  afterAll(async () => {
    await ctx.pool.end();
    await app.close();
  });

  beforeEach(async () => {
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

  async function createOwnedAccount(
    email: string,
    opts: { closed?: boolean; currency?: string } = {},
  ) {
    const owner = await createMember(email, 'password1');
    const [ownerBank] = await ctx.db
      .insert(bank)
      .values({ memberId: owner.id, name: `Bank ${email}` })
      .returning();
    const [acc] = await ctx.db
      .insert(account)
      .values({
        bankId: ownerBank.id,
        name: 'Checking',
        currency: opts.currency ?? 'USD',
        closed: opts.closed ?? false,
      })
      .returning();
    return { owner, bank: ownerBank, account: acc };
  }

  it('creates a debit operation and rejects both-type validation errors', async () => {
    const { owner, account: acc } = await createOwnedAccount('op1@example.com');
    const { token, cookies } = await authedRequest(
      'op1@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/operations')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: acc.id,
        type: 'debit',
        thirdParty: 'Grocery Store',
        amount: 42.5,
        paymentMethodId: 1,
        categoryId: 6, // Food (debit)
        valueDate: '2026-01-15',
      });

    expect(res.status).toBe(200);
    const created = (res.body as { operation: { id: number } }).operation;

    const [row] = await ctx.db
      .select()
      .from(operation)
      .where(sql`${operation.id} = ${created.id}`);
    expect(row.debit).toBe(425000);
    expect(row.credit).toBeNull();
    expect(row.accountId).toBe(acc.id);
    void owner;
  });

  it('rejects a credit-type payment method on a debit operation', async () => {
    const { account: acc } = await createOwnedAccount('op2@example.com');
    const { token, cookies } = await authedRequest(
      'op2@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/operations')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: acc.id,
        type: 'debit',
        thirdParty: 'Employer',
        amount: 100,
        paymentMethodId: 7, // Deposit, credit-only
      });

    expect(res.status).toBe(400);
  });

  it('rejects a mismatched-type category', async () => {
    const { account: acc } = await createOwnedAccount('op3@example.com');
    const { token, cookies } = await authedRequest(
      'op3@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/operations')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: acc.id,
        type: 'debit',
        thirdParty: 'Grocery Store',
        amount: 10,
        paymentMethodId: 1,
        categoryId: 1, // Salary, credit-only
      });

    expect(res.status).toBe(400);
  });

  it('rejects operation creation on a closed account', async () => {
    const { account: acc } = await createOwnedAccount('op4@example.com', {
      closed: true,
    });
    const { token, cookies } = await authedRequest(
      'op4@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/operations')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: acc.id,
        type: 'debit',
        thirdParty: 'Grocery Store',
        amount: 10,
        paymentMethodId: 1,
      });

    expect(res.status).toBe(422);
  });

  it('returns not found listing operations for a deleted account', async () => {
    const { account: acc, bank: ownerBank } =
      await createOwnedAccount('op5@example.com');
    await ctx.db
      .update(account)
      .set({ deleted: true })
      .where(sql`${account.id} = ${acc.id}`);
    const { token, cookies } = await authedRequest(
      'op5@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .get(`/operations?accountId=${acc.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(404);
    void ownerBank;
  });

  it('lists operations on a closed account (listable-only)', async () => {
    const { account: acc } = await createOwnedAccount('op6@example.com', {
      closed: true,
    });
    await ctx.db.insert(operation).values({
      accountId: acc.id,
      thirdParty: 'Old Op',
      paymentMethodId: 1,
      debit: 1000,
      valueDate: '2026-01-01',
    });
    const { token, cookies } = await authedRequest(
      'op6@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .get(`/operations?accountId=${acc.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(200);
    const body = res.body as { items: unknown[]; total: number };
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it('sorts operations by value date desc, then created desc, then id desc, paginated at 20', async () => {
    const { account: acc } = await createOwnedAccount('op7@example.com');
    for (let i = 0; i < 25; i++) {
      await ctx.db.insert(operation).values({
        accountId: acc.id,
        thirdParty: `Op ${i}`,
        paymentMethodId: 1,
        debit: 100,
        valueDate: '2026-01-01',
      });
    }
    const { token, cookies } = await authedRequest(
      'op7@example.com',
      'password1',
    );

    const page1 = await request(app.getHttpServer())
      .get(`/operations?accountId=${acc.id}&page=1`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');
    expect(page1.status).toBe(200);
    const body1 = page1.body as { items: { id: number }[]; total: number };
    expect(body1.items).toHaveLength(20);
    expect(body1.total).toBe(25);
    expect(body1.items[0].id).toBe(25);
    expect(body1.items[19].id).toBe(6);

    const page2 = await request(app.getHttpServer())
      .get(`/operations?accountId=${acc.id}&page=2`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');
    const body2 = page2.body as { items: { id: number }[] };
    expect(body2.items).toHaveLength(5);
    expect(body2.items[0].id).toBe(5);
    expect(body2.items[4].id).toBe(1);
  });

  it('keeps the account immutable and rejects editing the opening operation', async () => {
    const { account: acc } = await createOwnedAccount('op8@example.com');
    const { account: otherAcc } = await createOwnedAccount('op8b@example.com');
    const { token, cookies } = await authedRequest(
      'op8@example.com',
      'password1',
    );

    const [opening] = await ctx.db
      .insert(operation)
      .values({
        accountId: acc.id,
        thirdParty: 'Initial balance',
        paymentMethodId: 9,
        credit: 500000,
        reconciled: true,
        valueDate: '2026-01-01',
      })
      .returning();

    const openingRes = await request(app.getHttpServer())
      .patch(`/operations/${opening.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: acc.id,
        type: 'credit',
        thirdParty: 'Initial balance',
        amount: 50,
        paymentMethodId: 7,
        valueDate: '2026-01-01',
      });
    expect(openingRes.status).toBe(422);

    const [regular] = await ctx.db
      .insert(operation)
      .values({
        accountId: acc.id,
        thirdParty: 'Regular',
        paymentMethodId: 1,
        debit: 1000,
        valueDate: '2026-01-01',
      })
      .returning();

    const { token: token2, cookies: cookies2 } =
      await getCsrfTokenAndCookies(cookies);
    const moveRes = await request(app.getHttpServer())
      .patch(`/operations/${regular.id}`)
      .set('Cookie', cookies2)
      .set('x-csrf-token', token2)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: otherAcc.id,
        type: 'debit',
        thirdParty: 'Regular',
        amount: 10,
        paymentMethodId: 1,
        valueDate: '2026-01-01',
      });
    expect(moveRes.status).toBe(400);

    const { token: token3, cookies: cookies3 } =
      await getCsrfTokenAndCookies(cookies);
    const okRes = await request(app.getHttpServer())
      .patch(`/operations/${regular.id}`)
      .set('Cookie', cookies3)
      .set('x-csrf-token', token3)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: acc.id,
        type: 'debit',
        thirdParty: 'Regular Renamed',
        amount: 12,
        paymentMethodId: 1,
        valueDate: '2026-01-02',
      });
    expect(okRes.status).toBe(200);

    const [updated] = await ctx.db
      .select()
      .from(operation)
      .where(sql`${operation.id} = ${regular.id}`);
    expect(updated.thirdParty).toBe('Regular Renamed');
    expect(updated.debit).toBe(120000);
  });

  it('returns not found for a non-owner even when the account is closed', async () => {
    const { account: acc } = await createOwnedAccount('op9@example.com', {
      closed: true,
    });
    await createMember('intruder9@example.com', 'password1');
    const { token, cookies } = await authedRequest(
      'intruder9@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .get(`/operations?accountId=${acc.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(404);
  });

  it('discards the transfer account when the payment method is not a transfer method', async () => {
    const { account: acc } = await createOwnedAccount('op10@example.com');
    const { account: other } = await createOwnedAccount('op10b@example.com');
    const { token, cookies } = await authedRequest(
      'op10@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/operations')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: acc.id,
        type: 'debit',
        thirdParty: 'Not a transfer',
        amount: 10,
        paymentMethodId: 1,
        transferAccountId: other.id,
      });

    expect(res.status).toBe(200);
    const created = (res.body as { operation: { id: number } }).operation;
    const [row] = await ctx.db
      .select()
      .from(operation)
      .where(sql`${operation.id} = ${created.id}`);
    expect(row.transferAccountId).toBeNull();
  });
});

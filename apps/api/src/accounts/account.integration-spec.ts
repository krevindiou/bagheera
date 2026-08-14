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
import { AccountsModule } from './accounts.module';

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

describe('accounts (integration)', () => {
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

  it('creates an account with a non-zero initial balance and its opening operation', async () => {
    const owner = await createMember('acc1@example.com', 'password1');
    const [ownerBank] = await ctx.db
      .insert(bank)
      .values({ memberId: owner.id, name: 'Bank One' })
      .returning();
    const { token, cookies } = await authedRequest(
      'acc1@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/accounts')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        bankId: ownerBank.id,
        name: 'Checking',
        currency: 'USD',
        initialBalance: 123.45,
      });

    expect(res.status).toBe(200);
    const created = (res.body as { account: { id: number } }).account;

    const ops = await ctx.db
      .select()
      .from(operation)
      .where(sql`${operation.accountId} = ${created.id}`);
    expect(ops).toHaveLength(1);
    expect(ops[0].thirdParty).toBe('Initial balance');
    expect(ops[0].paymentMethodId).toBe(9);
    expect(ops[0].credit).toBe(1234500);
    expect(ops[0].debit).toBeNull();
    expect(ops[0].reconciled).toBe(true);
  });

  it('creates an account with a negative initial balance as a debit', async () => {
    const owner = await createMember('acc2@example.com', 'password1');
    const [ownerBank] = await ctx.db
      .insert(bank)
      .values({ memberId: owner.id, name: 'Bank Two' })
      .returning();
    const { token, cookies } = await authedRequest(
      'acc2@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/accounts')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        bankId: ownerBank.id,
        name: 'Overdraft',
        currency: 'USD',
        initialBalance: -50,
      });

    expect(res.status).toBe(200);
    const created = (res.body as { account: { id: number } }).account;
    const ops = await ctx.db
      .select()
      .from(operation)
      .where(sql`${operation.accountId} = ${created.id}`);
    expect(ops).toHaveLength(1);
    expect(ops[0].debit).toBe(500000);
    expect(ops[0].credit).toBeNull();
  });

  it('creates no opening operation for a zero/omitted initial balance', async () => {
    const owner = await createMember('acc3@example.com', 'password1');
    const [ownerBank] = await ctx.db
      .insert(bank)
      .values({ memberId: owner.id, name: 'Bank Three' })
      .returning();
    const { token, cookies } = await authedRequest(
      'acc3@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/accounts')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ bankId: ownerBank.id, name: 'No Opening', currency: 'USD' });

    expect(res.status).toBe(200);
    const created = (res.body as { account: { id: number } }).account;
    const ops = await ctx.db
      .select()
      .from(operation)
      .where(sql`${operation.accountId} = ${created.id}`);
    expect(ops).toHaveLength(0);
  });

  it('rejects account creation on a closed bank', async () => {
    const owner = await createMember('acc4@example.com', 'password1');
    const [closedBank] = await ctx.db
      .insert(bank)
      .values({ memberId: owner.id, name: 'Closed Bank', closed: true })
      .returning();
    const { token, cookies } = await authedRequest(
      'acc4@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/accounts')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ bankId: closedBank.id, name: 'Nope', currency: 'USD' });

    expect(res.status).toBe(422);
  });

  it('keeps bank and currency immutable on edit', async () => {
    const owner = await createMember('acc5@example.com', 'password1');
    const [bankA] = await ctx.db
      .insert(bank)
      .values({ memberId: owner.id, name: 'Bank A' })
      .returning();
    const [bankB] = await ctx.db
      .insert(bank)
      .values({ memberId: owner.id, name: 'Bank B' })
      .returning();
    const [acc] = await ctx.db
      .insert(account)
      .values({ bankId: bankA.id, name: 'Original', currency: 'USD' })
      .returning();
    const { token, cookies } = await authedRequest(
      'acc5@example.com',
      'password1',
    );

    const okRes = await request(app.getHttpServer())
      .patch(`/accounts/${acc.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ name: 'Renamed', bankId: bankA.id, currency: 'USD' });
    expect(okRes.status).toBe(200);

    const { token: token2, cookies: cookies2 } =
      await getCsrfTokenAndCookies(cookies);
    const failRes = await request(app.getHttpServer())
      .patch(`/accounts/${acc.id}`)
      .set('Cookie', cookies2)
      .set('x-csrf-token', token2)
      .set('X-Forwarded-Proto', 'https')
      .send({ name: 'Renamed', bankId: bankB.id, currency: 'USD' });
    expect(failRes.status).toBe(400);

    const { token: token3, cookies: cookies3 } =
      await getCsrfTokenAndCookies(cookies);
    const currRes = await request(app.getHttpServer())
      .patch(`/accounts/${acc.id}`)
      .set('Cookie', cookies3)
      .set('x-csrf-token', token3)
      .set('X-Forwarded-Proto', 'https')
      .send({ name: 'Renamed', bankId: bankA.id, currency: 'EUR' });
    expect(currRes.status).toBe(400);
  });

  it('deletes any non-deleted account whose bank is non-deleted, including a closed one', async () => {
    const owner = await createMember('acc6@example.com', 'password1');
    const [ownerBank] = await ctx.db
      .insert(bank)
      .values({ memberId: owner.id, name: 'Bank Six' })
      .returning();
    const [closedAcc] = await ctx.db
      .insert(account)
      .values({
        bankId: ownerBank.id,
        name: 'Closed Acc',
        currency: 'USD',
        closed: true,
      })
      .returning();
    const { token, cookies } = await authedRequest(
      'acc6@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .delete(`/accounts/${closedAcc.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(200);

    const [row] = await ctx.db
      .select()
      .from(account)
      .where(sql`${account.id} = ${closedAcc.id}`);
    expect(row.deleted).toBe(true);
  });

  it('returns not found for an account whose bank is deleted, even for the owner', async () => {
    const owner = await createMember('acc7@example.com', 'password1');
    const [deletedBank] = await ctx.db
      .insert(bank)
      .values({ memberId: owner.id, name: 'Bank Seven', deleted: true })
      .returning();
    const [acc] = await ctx.db
      .insert(account)
      .values({ bankId: deletedBank.id, name: 'Orphan', currency: 'USD' })
      .returning();
    const { token, cookies } = await authedRequest(
      'acc7@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .delete(`/accounts/${acc.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(404);
  });

  it('returns not found for a non-owner even when the account is closed and deleted', async () => {
    const owner = await createMember('acc8@example.com', 'password1');
    await createMember('intruder8@example.com', 'password1');
    const [ownerBank] = await ctx.db
      .insert(bank)
      .values({ memberId: owner.id, name: 'Bank Eight' })
      .returning();
    const [theirs] = await ctx.db
      .insert(account)
      .values({
        bankId: ownerBank.id,
        name: 'Not Yours',
        currency: 'USD',
        closed: true,
        deleted: true,
      })
      .returning();
    const { token, cookies } = await authedRequest(
      'intruder8@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .delete(`/accounts/${theirs.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(404);
  });
});

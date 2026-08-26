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
import { account, bank, member, operation, scheduler } from '../db/schema';
import { EMAIL_PROVIDER } from '../email/email.constants';
import type { EmailProvider } from '../email/email-message';
import { EmailModule } from '../email/email.module';
import { OperationsModule } from '../operations/operations.module';
import { HashService } from '../security/hash.service';
import { SecurityModule } from '../security/security.module';
import { SessionModule } from '../session/session.module';
import { SchedulersModule } from './schedulers.module';

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

describe('schedulers (integration)', () => {
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
        SchedulersModule,
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
      sql`truncate table ${scheduler} restart identity cascade`,
    );
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

  it('creates a scheduler on a fully active account', async () => {
    const { account: acc } = await createOwnedAccount('sched1@example.com');
    const { token, cookies } = await authedRequest(
      'sched1@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/schedulers')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: acc.id,
        type: 'debit',
        thirdParty: 'Landlord',
        amount: 900,
        paymentMethodId: 2,
        valueDate: '2026-02-01',
        frequencyUnit: 'month',
        frequencyValue: 1,
      });

    expect(res.status).toBe(200);
    const created = (res.body as { scheduler: { id: number } }).scheduler;

    const [row] = await ctx.db
      .select()
      .from(scheduler)
      .where(sql`${scheduler.id} = ${created.id}`);
    expect(row.debit).toBe(9000000);
    expect(row.credit).toBeNull();
    expect(row.accountId).toBe(acc.id);
    expect(row.active).toBe(true);
    expect(row.frequencyUnit).toBe('month');
  });

  it('rejects a scheduler transfer target that belongs to another member', async () => {
    const { account: acc } = await createOwnedAccount('sched-xfer1@example.com');
    const { account: foreign } = await createOwnedAccount(
      'sched-xfer1-other@example.com',
    );
    const { token, cookies } = await authedRequest(
      'sched-xfer1@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/schedulers')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: acc.id,
        type: 'debit',
        thirdParty: 'Savings transfer',
        amount: 100,
        paymentMethodId: 4,
        transferAccountId: foreign.id,
        valueDate: '2026-02-01',
        frequencyValue: 1,
      });

    expect(res.status).toBe(400);
    const rows = await ctx.db.select().from(scheduler);
    expect(rows).toHaveLength(0);
  });

  it('rejects a scheduler transfer target in a different currency', async () => {
    const { bank: ownerBank, account: acc } = await createOwnedAccount(
      'sched-xfer2@example.com',
    );
    const [eurAccount] = await ctx.db
      .insert(account)
      .values({ bankId: ownerBank.id, name: 'Savings', currency: 'EUR' })
      .returning();
    const { token, cookies } = await authedRequest(
      'sched-xfer2@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/schedulers')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: acc.id,
        type: 'debit',
        thirdParty: 'Savings transfer',
        amount: 100,
        paymentMethodId: 4,
        transferAccountId: eurAccount.id,
        valueDate: '2026-02-01',
        frequencyValue: 1,
      });

    expect(res.status).toBe(400);
  });

  it('rejects a new (never-before-stored) closed scheduler transfer target', async () => {
    const { bank: ownerBank, account: acc } = await createOwnedAccount(
      'sched-xfer3@example.com',
    );
    const [closedTarget] = await ctx.db
      .insert(account)
      .values({ bankId: ownerBank.id, name: 'Savings', closed: true })
      .returning();
    const { token, cookies } = await authedRequest(
      'sched-xfer3@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/schedulers')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: acc.id,
        type: 'debit',
        thirdParty: 'Savings transfer',
        amount: 100,
        paymentMethodId: 4,
        transferAccountId: closedTarget.id,
        valueDate: '2026-02-01',
        frequencyValue: 1,
      });

    expect(res.status).toBe(400);
  });

  it('keeps an already-stored scheduler transfer target on update even after it closes', async () => {
    const { bank: ownerBank, account: acc } = await createOwnedAccount(
      'sched-xfer4@example.com',
    );
    const [target] = await ctx.db
      .insert(account)
      .values({ bankId: ownerBank.id, name: 'Savings' })
      .returning();
    const { token, cookies } = await authedRequest(
      'sched-xfer4@example.com',
      'password1',
    );

    const createRes = await request(app.getHttpServer())
      .post('/schedulers')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: acc.id,
        type: 'debit',
        thirdParty: 'Savings transfer',
        amount: 100,
        paymentMethodId: 4,
        transferAccountId: target.id,
        valueDate: '2026-02-01',
        frequencyValue: 1,
      });
    expect(createRes.status).toBe(200);
    const created = (createRes.body as { scheduler: { id: number } })
      .scheduler;

    // The target closes after the scheduler was linked to it.
    await ctx.db
      .update(account)
      .set({ closed: true })
      .where(sql`${account.id} = ${target.id}`);

    const { token: token2, cookies: cookies2 } =
      await getCsrfTokenAndCookies(cookies);
    const updateRes = await request(app.getHttpServer())
      .patch(`/schedulers/${created.id}`)
      .set('Cookie', cookies2)
      .set('x-csrf-token', token2)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: acc.id,
        type: 'debit',
        thirdParty: 'Savings transfer',
        amount: 150,
        paymentMethodId: 4,
        transferAccountId: target.id,
        valueDate: '2026-02-01',
        frequencyValue: 1,
      });

    // Keeping the same (now-closed) target is allowed — only *new* targets
    // must be fully active.
    expect(updateRes.status).toBe(200);
  });

  it('rejects creation on a closed account with an access-denied error', async () => {
    const { account: acc } = await createOwnedAccount('sched2@example.com', {
      closed: true,
    });
    const { token, cookies } = await authedRequest(
      'sched2@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/schedulers')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: acc.id,
        type: 'debit',
        thirdParty: 'Landlord',
        amount: 900,
        paymentMethodId: 2,
        valueDate: '2026-02-01',
        frequencyValue: 1,
      });

    expect(res.status).toBe(422);
  });

  it('rejects creation on a non-owned account with not-found', async () => {
    const { account: acc } = await createOwnedAccount(
      'sched3-owner@example.com',
    );
    await createMember('sched3-other@example.com', 'password1');
    const { token, cookies } = await authedRequest(
      'sched3-other@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/schedulers')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: acc.id,
        type: 'debit',
        thirdParty: 'Landlord',
        amount: 900,
        paymentMethodId: 2,
        valueDate: '2026-02-01',
        frequencyValue: 1,
      });

    expect(res.status).toBe(404);
  });

  it('lists schedulers on a closed account (listable-only)', async () => {
    const { account: acc, owner } =
      await createOwnedAccount('sched4@example.com');
    await ctx.db.insert(scheduler).values({
      accountId: acc.id,
      thirdParty: 'Landlord',
      debit: 9000000,
      paymentMethodId: 2,
      valueDate: '2026-02-01',
      frequencyValue: 1,
    });
    await ctx.db
      .update(account)
      .set({ closed: true })
      .where(sql`${account.id} = ${acc.id}`);
    const { cookies } = await authedRequest('sched4@example.com', 'password1');

    const res = await request(app.getHttpServer())
      .get(`/schedulers?accountId=${acc.id}`)
      .set('Cookie', cookies)
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(200);
    const body = res.body as { items: unknown[]; total: number };
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    void owner;
  });

  it('rejects edit and delete on a closed account with an access-denied error', async () => {
    const { account: acc } = await createOwnedAccount('sched5@example.com');
    const [created] = await ctx.db
      .insert(scheduler)
      .values({
        accountId: acc.id,
        thirdParty: 'Landlord',
        debit: 9000000,
        paymentMethodId: 2,
        valueDate: '2026-02-01',
        frequencyValue: 1,
      })
      .returning();
    await ctx.db
      .update(account)
      .set({ closed: true })
      .where(sql`${account.id} = ${acc.id}`);
    const { token, cookies } = await authedRequest(
      'sched5@example.com',
      'password1',
    );

    const updateRes = await request(app.getHttpServer())
      .patch(`/schedulers/${created.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: acc.id,
        type: 'debit',
        thirdParty: 'Landlord',
        amount: 950,
        paymentMethodId: 2,
        valueDate: '2026-02-01',
        frequencyValue: 1,
      });
    expect(updateRes.status).toBe(422);

    const deleteRes = await request(app.getHttpServer())
      .delete(`/schedulers/${created.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');
    expect(deleteRes.status).toBe(422);
  });

  it('rejects moving a scheduler to another account on update', async () => {
    const { account: acc } = await createOwnedAccount('sched6@example.com');
    const [otherAcc] = await ctx.db
      .insert(account)
      .values({ bankId: acc.bankId, name: 'Savings', currency: 'USD' })
      .returning();
    const [created] = await ctx.db
      .insert(scheduler)
      .values({
        accountId: acc.id,
        thirdParty: 'Landlord',
        debit: 9000000,
        paymentMethodId: 2,
        valueDate: '2026-02-01',
        frequencyValue: 1,
      })
      .returning();
    const { token, cookies } = await authedRequest(
      'sched6@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .patch(`/schedulers/${created.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: otherAcc.id,
        type: 'debit',
        thirdParty: 'Landlord',
        amount: 950,
        paymentMethodId: 2,
        valueDate: '2026-02-01',
        frequencyValue: 1,
      });

    expect(res.status).toBe(400);
  });

  it('updates a scheduler on a fully active account', async () => {
    const { account: acc } = await createOwnedAccount('sched7@example.com');
    const [created] = await ctx.db
      .insert(scheduler)
      .values({
        accountId: acc.id,
        thirdParty: 'Landlord',
        debit: 9000000,
        paymentMethodId: 2,
        valueDate: '2026-02-01',
        frequencyValue: 1,
      })
      .returning();
    const { token, cookies } = await authedRequest(
      'sched7@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .patch(`/schedulers/${created.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: acc.id,
        type: 'debit',
        thirdParty: 'Landlord',
        amount: 950,
        paymentMethodId: 2,
        valueDate: '2026-03-01',
        frequencyUnit: 'month',
        frequencyValue: 1,
        active: false,
      });

    expect(res.status).toBe(200);
    const [row] = await ctx.db
      .select()
      .from(scheduler)
      .where(sql`${scheduler.id} = ${created.id}`);
    expect(row.debit).toBe(9500000);
    expect(row.active).toBe(false);
  });

  it('deletes a scheduler and drops the link from generated operations', async () => {
    const { account: acc } = await createOwnedAccount('sched8@example.com');
    const [created] = await ctx.db
      .insert(scheduler)
      .values({
        accountId: acc.id,
        thirdParty: 'Landlord',
        debit: 9000000,
        paymentMethodId: 2,
        valueDate: '2026-02-01',
        frequencyValue: 1,
      })
      .returning();
    const [generatedOp] = await ctx.db
      .insert(operation)
      .values({
        accountId: acc.id,
        schedulerId: created.id,
        thirdParty: 'Landlord',
        debit: 9000000,
        paymentMethodId: 2,
        valueDate: '2026-02-01',
      })
      .returning();
    const { token, cookies } = await authedRequest(
      'sched8@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .delete(`/schedulers/${created.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(200);

    const [row] = await ctx.db
      .select()
      .from(scheduler)
      .where(sql`${scheduler.id} = ${created.id}`);
    expect(row).toBeUndefined();

    const [op] = await ctx.db
      .select()
      .from(operation)
      .where(sql`${operation.id} = ${generatedOp.id}`);
    expect(op.schedulerId).toBeNull();
  });

  it('rejects a mismatched-type category', async () => {
    const { account: acc } = await createOwnedAccount('sched9@example.com');
    const { token, cookies } = await authedRequest(
      'sched9@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/schedulers')
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
        valueDate: '2026-02-01',
        frequencyValue: 1,
      });

    expect(res.status).toBe(400);
  });
});

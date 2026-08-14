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
import { account, bank, member, operation, scheduler } from '../db/schema';
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

const TRANSFER_DEBIT = 4;
const TRANSFER_CREDIT = 6;

describe('transfer pairing (integration)', () => {
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

  // Creates a member owning one bank and `names.length` accounts under it,
  // all sharing the given currency unless overridden per account.
  async function createOwnerWithAccounts(
    email: string,
    accounts: { name: string; currency?: string; closed?: boolean }[],
  ) {
    const owner = await createMember(email, 'password1');
    const [ownerBank] = await ctx.db
      .insert(bank)
      .values({ memberId: owner.id, name: `Bank ${email}` })
      .returning();
    const rows = [];
    for (const spec of accounts) {
      const [row] = await ctx.db
        .insert(account)
        .values({
          bankId: ownerBank.id,
          name: spec.name,
          currency: spec.currency ?? 'USD',
          closed: spec.closed ?? false,
        })
        .returning();
      rows.push(row);
    }
    return { owner, bank: ownerBank, accounts: rows };
  }

  async function fetchOperation(id: number) {
    const [row] = await ctx.db
      .select()
      .from(operation)
      .where(sql`${operation.id} = ${id}`);
    return row;
  }

  it('creates a mirrored operation in the transfer target account', async () => {
    const { accounts } = await createOwnerWithAccounts('t1@example.com', [
      { name: 'Checking' },
      { name: 'Savings' },
    ]);
    const [source, target] = accounts;
    const { token, cookies } = await authedRequest('t1@example.com', 'password1');

    const res = await request(app.getHttpServer())
      .post('/operations')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: source.id,
        type: 'debit',
        thirdParty: 'To Savings',
        amount: 25,
        paymentMethodId: TRANSFER_DEBIT,
        transferAccountId: target.id,
        valueDate: '2026-01-10',
        notes: 'moving cash',
      });

    expect(res.status).toBe(200);
    const created = (res.body as { operation: { id: number } }).operation;
    const sourceRow = await fetchOperation(created.id);
    expect(sourceRow.transferAccountId).toBe(target.id);
    expect(sourceRow.transferOperationId).not.toBeNull();

    const mirror = await fetchOperation(sourceRow.transferOperationId!);
    expect(mirror.accountId).toBe(target.id);
    expect(mirror.paymentMethodId).toBe(TRANSFER_CREDIT);
    expect(mirror.debit).toBeNull();
    expect(mirror.credit).toBe(250000);
    expect(mirror.thirdParty).toBe('To Savings');
    expect(mirror.notes).toBe('moving cash');
    expect(mirror.valueDate).toBe('2026-01-10');
    expect(mirror.categoryId).toBeNull();
    expect(mirror.reconciled).toBe(false);
    expect(mirror.transferAccountId).toBe(source.id);
    expect(mirror.transferOperationId).toBe(sourceRow.id);
  });

  it('rejects a transfer target of a different currency', async () => {
    const { accounts } = await createOwnerWithAccounts('t2@example.com', [
      { name: 'USD Checking', currency: 'USD' },
      { name: 'EUR Checking', currency: 'EUR' },
    ]);
    const [source, target] = accounts;
    const { token, cookies } = await authedRequest('t2@example.com', 'password1');

    const res = await request(app.getHttpServer())
      .post('/operations')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: source.id,
        type: 'debit',
        thirdParty: 'Cross currency',
        amount: 10,
        paymentMethodId: TRANSFER_DEBIT,
        transferAccountId: target.id,
      });

    expect(res.status).toBe(400);
  });

  it('rejects a closed account as a new transfer target', async () => {
    const { accounts } = await createOwnerWithAccounts('t3@example.com', [
      { name: 'Checking' },
      { name: 'Closed', closed: true },
    ]);
    const [source, target] = accounts;
    const { token, cookies } = await authedRequest('t3@example.com', 'password1');

    const res = await request(app.getHttpServer())
      .post('/operations')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: source.id,
        type: 'debit',
        thirdParty: 'To closed',
        amount: 10,
        paymentMethodId: TRANSFER_DEBIT,
        transferAccountId: target.id,
      });

    expect(res.status).toBe(400);
  });

  it('records a plain External transfer with no mirror when no target is chosen', async () => {
    const { accounts } = await createOwnerWithAccounts('t4@example.com', [
      { name: 'Checking' },
    ]);
    const [source] = accounts;
    const { token, cookies } = await authedRequest('t4@example.com', 'password1');

    const res = await request(app.getHttpServer())
      .post('/operations')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: source.id,
        type: 'debit',
        thirdParty: 'External withdrawal',
        amount: 10,
        paymentMethodId: TRANSFER_DEBIT,
      });

    expect(res.status).toBe(200);
    const created = (res.body as { operation: { id: number } }).operation;
    const row = await fetchOperation(created.id);
    expect(row.transferAccountId).toBeNull();
    expect(row.transferOperationId).toBeNull();
  });

  it('keeps the pair in sync when editing either side, excluding category and reconciled', async () => {
    const { accounts } = await createOwnerWithAccounts('t5@example.com', [
      { name: 'Checking' },
      { name: 'Savings' },
    ]);
    const [source, target] = accounts;
    const { token, cookies } = await authedRequest('t5@example.com', 'password1');

    const createRes = await request(app.getHttpServer())
      .post('/operations')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: source.id,
        type: 'debit',
        thirdParty: 'Original',
        amount: 25,
        paymentMethodId: TRANSFER_DEBIT,
        categoryId: undefined,
        transferAccountId: target.id,
        valueDate: '2026-01-10',
        reconciled: true,
      });
    expect(createRes.status).toBe(200);
    const created = (createRes.body as { operation: { id: number } }).operation;
    const sourceRow = await fetchOperation(created.id);
    const mirrorId = sourceRow.transferOperationId!;

    const { token: token2, cookies: cookies2 } =
      await getCsrfTokenAndCookies(cookies);
    const editRes = await request(app.getHttpServer())
      .patch(`/operations/${sourceRow.id}`)
      .set('Cookie', cookies2)
      .set('x-csrf-token', token2)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: source.id,
        type: 'debit',
        thirdParty: 'Renamed',
        amount: 30,
        paymentMethodId: TRANSFER_DEBIT,
        transferAccountId: target.id,
        valueDate: '2026-01-11',
        notes: 'edited',
        reconciled: true,
      });
    expect(editRes.status).toBe(200);

    const mirror = await fetchOperation(mirrorId);
    expect(mirror.thirdParty).toBe('Renamed');
    expect(mirror.credit).toBe(300000);
    expect(mirror.valueDate).toBe('2026-01-11');
    expect(mirror.notes).toBe('edited');
    // Reconciled is never mirrored — the mirror stays unreconciled.
    expect(mirror.reconciled).toBe(false);
    expect(mirror.categoryId).toBeNull();
  });

  it('retargets the mirror to a new account when the transfer account changes', async () => {
    const { accounts } = await createOwnerWithAccounts('t6@example.com', [
      { name: 'Checking' },
      { name: 'Savings A' },
      { name: 'Savings B' },
    ]);
    const [source, targetA, targetB] = accounts;
    const { token, cookies } = await authedRequest('t6@example.com', 'password1');

    const createRes = await request(app.getHttpServer())
      .post('/operations')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: source.id,
        type: 'debit',
        thirdParty: 'Retarget me',
        amount: 15,
        paymentMethodId: TRANSFER_DEBIT,
        transferAccountId: targetA.id,
      });
    const created = (createRes.body as { operation: { id: number } }).operation;
    const beforeRow = await fetchOperation(created.id);
    const originalMirrorId = beforeRow.transferOperationId!;

    const { token: token2, cookies: cookies2 } =
      await getCsrfTokenAndCookies(cookies);
    const editRes = await request(app.getHttpServer())
      .patch(`/operations/${beforeRow.id}`)
      .set('Cookie', cookies2)
      .set('x-csrf-token', token2)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: source.id,
        type: 'debit',
        thirdParty: 'Retarget me',
        amount: 15,
        paymentMethodId: TRANSFER_DEBIT,
        transferAccountId: targetB.id,
        valueDate: '2026-01-10',
      });
    expect(editRes.status).toBe(200);

    const mirror = await fetchOperation(originalMirrorId);
    expect(mirror.accountId).toBe(targetB.id);

    const targetAOps = await ctx.db
      .select()
      .from(operation)
      .where(sql`${operation.accountId} = ${targetA.id}`);
    expect(targetAOps).toHaveLength(0);
  });

  it('deletes the mirror when the pair is unlinked via payment method change', async () => {
    const { accounts } = await createOwnerWithAccounts('t7@example.com', [
      { name: 'Checking' },
      { name: 'Savings' },
    ]);
    const [source, target] = accounts;
    const { token, cookies } = await authedRequest('t7@example.com', 'password1');

    const createRes = await request(app.getHttpServer())
      .post('/operations')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: source.id,
        type: 'debit',
        thirdParty: 'Unlink me',
        amount: 15,
        paymentMethodId: TRANSFER_DEBIT,
        transferAccountId: target.id,
      });
    const created = (createRes.body as { operation: { id: number } }).operation;
    const beforeRow = await fetchOperation(created.id);
    const mirrorId = beforeRow.transferOperationId!;

    const { token: token2, cookies: cookies2 } =
      await getCsrfTokenAndCookies(cookies);
    const editRes = await request(app.getHttpServer())
      .patch(`/operations/${beforeRow.id}`)
      .set('Cookie', cookies2)
      .set('x-csrf-token', token2)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: source.id,
        type: 'debit',
        thirdParty: 'Unlink me',
        amount: 15,
        paymentMethodId: 1, // no longer a transfer method
        valueDate: '2026-01-10',
      });
    expect(editRes.status).toBe(200);

    const afterRow = await fetchOperation(beforeRow.id);
    expect(afterRow.transferAccountId).toBeNull();
    expect(afterRow.transferOperationId).toBeNull();
    const mirror = await fetchOperation(mirrorId);
    expect(mirror).toBeUndefined();
  });

  it('converts the surviving side to External when one half of a pair is deleted', async () => {
    const { accounts } = await createOwnerWithAccounts('t8@example.com', [
      { name: 'Checking' },
      { name: 'Savings' },
    ]);
    const [source, target] = accounts;
    const { token, cookies } = await authedRequest('t8@example.com', 'password1');

    const createRes = await request(app.getHttpServer())
      .post('/operations')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: source.id,
        type: 'debit',
        thirdParty: 'Delete me',
        amount: 15,
        paymentMethodId: TRANSFER_DEBIT,
        transferAccountId: target.id,
      });
    const created = (createRes.body as { operation: { id: number } }).operation;
    const sourceRow = await fetchOperation(created.id);
    const mirrorId = sourceRow.transferOperationId!;

    const { token: token2, cookies: cookies2 } =
      await getCsrfTokenAndCookies(cookies);
    const delRes = await request(app.getHttpServer())
      .post('/operations/batch/delete')
      .set('Cookie', cookies2)
      .set('x-csrf-token', token2)
      .set('X-Forwarded-Proto', 'https')
      .send({ ids: [sourceRow.id] });
    expect(delRes.status).toBe(200);

    const survivor = await fetchOperation(mirrorId);
    expect(survivor).toBeDefined();
    expect(survivor.transferAccountId).toBeNull();
    expect(survivor.transferOperationId).toBeNull();
    const deleted = await fetchOperation(sourceRow.id);
    expect(deleted).toBeUndefined();
  });

  it('converts other accounts\' transfer references to External when an account is deleted', async () => {
    const { accounts, owner } = await createOwnerWithAccounts(
      't9@example.com',
      [{ name: 'Checking' }, { name: 'Savings' }],
    );
    const [source, target] = accounts;
    const { token, cookies } = await authedRequest('t9@example.com', 'password1');

    const createRes = await request(app.getHttpServer())
      .post('/operations')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: source.id,
        type: 'debit',
        thirdParty: 'Kept alive',
        amount: 15,
        paymentMethodId: TRANSFER_DEBIT,
        transferAccountId: target.id,
      });
    const created = (createRes.body as { operation: { id: number } }).operation;
    const sourceRow = await fetchOperation(created.id);

    await ctx.db.insert(scheduler).values({
      accountId: source.id,
      transferAccountId: target.id,
      paymentMethodId: TRANSFER_DEBIT,
      thirdParty: 'Scheduled transfer',
      debit: 5000,
      valueDate: '2026-01-01',
      frequencyValue: 1,
    });

    const { token: token2, cookies: cookies2 } =
      await getCsrfTokenAndCookies(cookies);
    const delRes = await request(app.getHttpServer())
      .delete(`/accounts/${target.id}`)
      .set('Cookie', cookies2)
      .set('x-csrf-token', token2)
      .set('X-Forwarded-Proto', 'https');
    expect(delRes.status).toBe(200);

    const survivor = await fetchOperation(sourceRow.id);
    expect(survivor.transferAccountId).toBeNull();
    expect(survivor.transferOperationId).toBeNull();

    const [sched] = await ctx.db
      .select()
      .from(scheduler)
      .where(sql`${scheduler.accountId} = ${source.id}`);
    expect(sched.transferAccountId).toBeNull();
    void owner;
  });
});

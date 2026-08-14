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
import { account, bank, member, operation, securityEvent } from '../db/schema';
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

describe('operations batch actions (integration)', () => {
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
      sql`truncate table ${securityEvent} restart identity cascade`,
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

  async function insertOperation(accountId: number, thirdParty: string) {
    const [row] = await ctx.db
      .insert(operation)
      .values({
        accountId,
        thirdParty,
        paymentMethodId: 1,
        debit: 1000,
        valueDate: '2026-01-01',
      })
      .returning();
    return row;
  }

  it('deletes only owned ids, silently skips foreign/nonexistent, and writes an audit event', async () => {
    const { account: acc, owner } =
      await createOwnedAccount('batch1@example.com');
    const { account: otherAcc } = await createOwnedAccount(
      'batch1b@example.com',
    );
    const owned = await insertOperation(acc.id, 'Mine');
    const foreign = await insertOperation(otherAcc.id, 'Not mine');
    const nonexistentId = 999999;

    const { token, cookies } = await authedRequest(
      'batch1@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/operations/batch/delete')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ ids: [owned.id, foreign.id, nonexistentId] });

    expect(res.status).toBe(200);
    expect((res.body as { deletedCount: number }).deletedCount).toBe(1);

    const remainingIds = (
      await ctx.db.select({ id: operation.id }).from(operation)
    ).map((r) => r.id);
    expect(remainingIds).toEqual([foreign.id]);

    const events = await ctx.db
      .select()
      .from(securityEvent)
      .where(sql`${securityEvent.eventType} = 'operation_batch_deleted'`);
    expect(events).toHaveLength(1);
    expect(events[0].memberId).toBe(owner.id);
  });

  it('reconciles only owned ids, silently skips foreign/nonexistent, and writes an audit event', async () => {
    const { account: acc } = await createOwnedAccount('batch2@example.com');
    const { account: otherAcc } = await createOwnedAccount(
      'batch2b@example.com',
    );
    const owned = await insertOperation(acc.id, 'Mine');
    const foreign = await insertOperation(otherAcc.id, 'Not mine');

    const { token, cookies } = await authedRequest(
      'batch2@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/operations/batch/reconcile')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ ids: [owned.id, foreign.id, 999999] });

    expect(res.status).toBe(200);
    expect((res.body as { reconciledCount: number }).reconciledCount).toBe(1);

    const [ownedRow] = await ctx.db
      .select()
      .from(operation)
      .where(sql`${operation.id} = ${owned.id}`);
    expect(ownedRow.reconciled).toBe(true);

    const [foreignRow] = await ctx.db
      .select()
      .from(operation)
      .where(sql`${operation.id} = ${foreign.id}`);
    expect(foreignRow.reconciled).toBe(false);

    const events = await ctx.db
      .select()
      .from(securityEvent)
      .where(sql`${securityEvent.eventType} = 'operation_batch_reconciled'`);
    expect(events).toHaveLength(1);
  });

  it('rejects an empty ids array', async () => {
    const { token, cookies } = await authedRequest(
      (await createOwnedAccount('batch3@example.com')).owner.email,
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/operations/batch/delete')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ ids: [] });

    expect(res.status).toBe(400);
  });
});

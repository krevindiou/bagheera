import { Controller, Get, Req, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { eq, sql } from 'drizzle-orm';
import type { Request } from 'express';
import { MinorUnits } from '../common/money';
import request from 'supertest';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthModule } from '../auth/auth.module';
import { BanksModule } from '../banks/banks.module';
import { DbModule } from '../db/db.module';
import {
  account,
  bank,
  member,
  operation,
  scheduler,
  securityEvent,
} from '../db/schema';
import {
  connectIntegrationDb,
  IntegrationDb,
} from '../db/test-utils/integration-db';
import { EMAIL_PROVIDER } from '../email/email.constants';
import type { EmailProvider } from '../email/email-message';
import { EmailModule } from '../email/email.module';
import { OperationsModule } from '../operations/operations.module';
import { HashService } from '../security/hash.service';
import { SecurityModule } from '../security/security.module';
import { SessionModule } from '../session/session.module';
import { SchedulersModule } from './schedulers.module';
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

describe('scheduler batch actions (integration)', () => {
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
      sql`truncate table ${securityEvent} restart identity cascade`,
    );
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

  async function insertScheduler(accountId: number, thirdParty: string) {
    const [row] = await ctx.db
      .insert(scheduler)
      .values({
        accountId,
        thirdParty,
        debit: 100000 as MinorUnits,
        paymentMethodId: 2,
        valueDate: '2030-01-01', // future — never due, so no generated ops
        frequencyValue: 1,
        frequencyUnit: 'month',
      })
      .returning();
    return row;
  }

  it('deletes only owned ids, silently skips foreign/nonexistent, and writes an audit event', async () => {
    const { owner, account: acc } = await createOwnedAccount(
      'sbatch1@example.com',
    );
    const { account: otherAcc } = await createOwnedAccount(
      'sbatch1-other@example.com',
    );

    const owned = await insertScheduler(acc.id, 'Mine');
    const foreign = await insertScheduler(otherAcc.id, 'Not mine');
    const nonexistentId = 999999;

    const { token, cookies } = await authedRequest(
      'sbatch1@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/schedulers/batch/delete')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ ids: [owned.id, foreign.id, nonexistentId] });

    expect(res.status).toBe(200);
    expect((res.body as { deletedCount: number }).deletedCount).toBe(1);

    const remaining = await ctx.db.select({ id: scheduler.id }).from(scheduler);
    expect(remaining.map((r) => r.id)).toEqual([foreign.id]);

    const [event] = await ctx.db
      .select()
      .from(securityEvent)
      .where(sql`${securityEvent.eventType} = 'scheduler_batch_deleted'`);
    expect(event).toBeDefined();
    expect(event.memberId).toBe(owner.id);
  });

  it('drops the scheduler link from generated operations instead of deleting them', async () => {
    const { account: acc } = await createOwnedAccount('sbatch2@example.com');
    const owned = await insertScheduler(acc.id, 'Mine');
    const [generatedOp] = await ctx.db
      .insert(operation)
      .values({
        accountId: acc.id,
        schedulerId: owned.id,
        thirdParty: 'Mine',
        debit: 100000 as MinorUnits,
        paymentMethodId: 2,
        valueDate: '2026-01-01',
      })
      .returning();

    const { token, cookies } = await authedRequest(
      'sbatch2@example.com',
      'password1',
    );
    const res = await request(app.getHttpServer())
      .post('/schedulers/batch/delete')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ ids: [owned.id] });

    expect(res.status).toBe(200);
    expect((res.body as { deletedCount: number }).deletedCount).toBe(1);

    const [op] = await ctx.db
      .select()
      .from(operation)
      .where(eq(operation.id, generatedOp.id));
    expect(op).toBeDefined();
    expect(op.schedulerId).toBeNull();
  });

  it('does nothing and still writes an audit event when every id is foreign', async () => {
    const { account: otherAcc } = await createOwnedAccount(
      'sbatch3-other@example.com',
    );
    await createOwnedAccount('sbatch3@example.com');
    const foreign = await insertScheduler(otherAcc.id, 'Not mine');

    const { token, cookies } = await authedRequest(
      'sbatch3@example.com',
      'password1',
    );
    const res = await request(app.getHttpServer())
      .post('/schedulers/batch/delete')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ ids: [foreign.id] });

    expect(res.status).toBe(200);
    expect((res.body as { deletedCount: number }).deletedCount).toBe(0);

    const [stillThere] = await ctx.db
      .select()
      .from(scheduler)
      .where(eq(scheduler.id, foreign.id));
    expect(stillThere).toBeDefined();

    const [event] = await ctx.db
      .select()
      .from(securityEvent)
      .where(sql`${securityEvent.eventType} = 'scheduler_batch_deleted'`);
    expect(event).toBeDefined();
  });
});

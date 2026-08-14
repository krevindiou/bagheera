import { Controller, Get, Req, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { eq, sql } from 'drizzle-orm';
import type { Request } from 'express';
import request from 'supertest';
import { AccountsModule } from '../accounts/accounts.module';
import { SchedulerCatchUpService } from '../auth/scheduler-catch-up.service';
import { AuthModule } from '../auth/auth.module';
import { BanksModule } from '../banks/banks.module';
import { DbModule } from '../db/db.module';
import { account, bank, member, operation, scheduler } from '../db/schema';
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
import { dueOccurrences } from './generation/interval';
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

describe('scheduler generation (integration)', () => {
  let app: NestExpressApplication;
  let ctx: IntegrationDb;
  let hash: HashService;
  let catchUp: SchedulerCatchUpService;

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
    catchUp = moduleRef.get(SchedulerCatchUpService);
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

  async function createOwnedAccount(email: string, currency = 'USD') {
    const owner = await createMember(email, 'password1');
    const [ownerBank] = await ctx.db
      .insert(bank)
      .values({ memberId: owner.id, name: `Bank ${email}` })
      .returning();
    const [acc] = await ctx.db
      .insert(account)
      .values({ bankId: ownerBank.id, name: 'Checking', currency })
      .returning();
    return { owner, bank: ownerBank, account: acc };
  }

  async function insertScheduler(
    overrides: Partial<typeof scheduler.$inferInsert>,
  ) {
    const [row] = await ctx.db
      .insert(scheduler)
      .values({
        accountId: overrides.accountId!,
        thirdParty: 'Landlord',
        debit: 9000000,
        paymentMethodId: 2,
        valueDate: '2020-01-15',
        frequencyValue: 1,
        frequencyUnit: 'month',
        ...overrides,
      })
      .returning();
    return row;
  }

  function operationsFor(schedulerId: number, accountId?: number) {
    return ctx.db
      .select()
      .from(operation)
      .where(
        accountId
          ? sql`${operation.schedulerId} = ${schedulerId} and ${operation.accountId} = ${accountId}`
          : sql`${operation.schedulerId} = ${schedulerId}`,
      )
      .orderBy(operation.valueDate);
  }

  // Deleting a paired operation must first clear both sides' cross-links —
  // the transfer FK forbids deleting a row another operation still points
  // at — mirroring what the real batch-delete path does before removal.
  async function deletePairedOperation(id: number) {
    const [row] = await ctx.db
      .select()
      .from(operation)
      .where(eq(operation.id, id));
    if (row?.transferOperationId) {
      await ctx.db
        .update(operation)
        .set({ transferOperationId: null, transferAccountId: null })
        .where(eq(operation.id, row.transferOperationId));
    }
    await ctx.db
      .update(operation)
      .set({ transferOperationId: null })
      .where(eq(operation.id, id));
    await ctx.db.delete(operation).where(eq(operation.id, id));
  }

  it('generates every occurrence missed during a long absence, at sign-in', async () => {
    const { owner, account: acc } =
      await createOwnedAccount('gen1@example.com');
    await insertScheduler({ accountId: acc.id, valueDate: '2020-01-15' });

    await catchUp.catchUp(owner.id);

    const ops = await ctx.db.select().from(operation);
    const expected = dueOccurrences({
      valueDate: '2020-01-15',
      frequencyUnit: 'month',
      frequencyValue: 1,
      after: null,
      horizon: new Date().toISOString().slice(0, 10),
    });
    expect(ops).toHaveLength(expected.length);
    expect(ops.map((o) => o.valueDate).sort()).toEqual(expected.sort());
  });

  it('generates immediately after saving a scheduler whose value date is already due', async () => {
    const { account: acc } = await createOwnedAccount('gen2@example.com');
    const { token, cookies } = await authedRequest(
      'gen2@example.com',
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
        valueDate: '2020-01-15',
        frequencyValue: 1,
      })
      .expect(200);

    const created = (res.body as { scheduler: { id: number } }).scheduler;
    const ops = await ctx.db
      .select()
      .from(operation)
      .where(eq(operation.schedulerId, created.id));
    expect(ops.length).toBeGreaterThan(1);
  });

  it('skips schedulers on a closed or deleted account, and on a deleted bank', async () => {
    const {
      owner,
      account: acc,
      bank: bnk,
    } = await createOwnedAccount('gen3@example.com');
    const s = await insertScheduler({ accountId: acc.id });
    await ctx.db
      .update(account)
      .set({ closed: true })
      .where(eq(account.id, acc.id));

    await catchUp.catchUp(owner.id);
    expect(await operationsFor(s.id)).toHaveLength(0);

    await ctx.db
      .update(account)
      .set({ closed: false, deleted: true })
      .where(eq(account.id, acc.id));
    await catchUp.catchUp(owner.id);
    expect(await operationsFor(s.id)).toHaveLength(0);

    await ctx.db
      .update(account)
      .set({ deleted: false })
      .where(eq(account.id, acc.id));
    await ctx.db.update(bank).set({ deleted: true }).where(eq(bank.id, bnk.id));
    await catchUp.catchUp(owner.id);
    expect(await operationsFor(s.id)).toHaveLength(0);
  });

  it('deleting the latest occurrence regenerates it; deleting an older one leaves a permanent gap', async () => {
    const { owner, account: acc } =
      await createOwnedAccount('gen4@example.com');
    const s = await insertScheduler({
      accountId: acc.id,
      valueDate: '2025-11-01',
    });
    await catchUp.catchUp(owner.id);

    const before = await operationsFor(s.id);
    expect(before.length).toBeGreaterThanOrEqual(3);

    // Delete the latest generated occurrence — the next run recreates it.
    const latest = before[before.length - 1];
    await ctx.db.delete(operation).where(eq(operation.id, latest.id));
    await catchUp.catchUp(owner.id);
    const afterLatestDeleted = await operationsFor(s.id);
    expect(afterLatestDeleted).toHaveLength(before.length);
    expect(afterLatestDeleted.map((o) => o.valueDate)).toEqual(
      before.map((o) => o.valueDate),
    );

    // Delete an older occurrence — tracking only looks past the latest
    // surviving one, so this gap is permanent.
    const older = afterLatestDeleted[0];
    await ctx.db.delete(operation).where(eq(operation.id, older.id));
    await catchUp.catchUp(owner.id);
    const afterOlderDeleted = await operationsFor(s.id);
    expect(afterOlderDeleted).toHaveLength(before.length - 1);
    expect(
      afterOlderDeleted.find((o) => o.valueDate === older.valueDate),
    ).toBeUndefined();
  });

  it('transfer-side tracking follows the source only', async () => {
    const { owner, account: source } =
      await createOwnedAccount('gen5@example.com');
    const [target] = await ctx.db
      .insert(account)
      .values({ bankId: source.bankId, name: 'Savings', currency: 'USD' })
      .returning();
    const s = await insertScheduler({
      accountId: source.id,
      paymentMethodId: 4, // Transfer, debit
      transferAccountId: target.id,
      valueDate: '2025-11-01',
    });
    await catchUp.catchUp(owner.id);

    const sourceOps = await operationsFor(s.id, source.id);
    const mirrorOps = await operationsFor(s.id, target.id);
    expect(sourceOps.length).toBeGreaterThanOrEqual(3);
    expect(mirrorOps).toHaveLength(sourceOps.length);

    // Deleting only the mirror doesn't trigger regeneration — the source
    // still marks the occurrence as generated.
    const latestMirror = mirrorOps[mirrorOps.length - 1];
    await deletePairedOperation(latestMirror.id);
    await catchUp.catchUp(owner.id);
    expect(await operationsFor(s.id, target.id)).toHaveLength(
      mirrorOps.length - 1,
    );
    expect(await operationsFor(s.id, source.id)).toHaveLength(sourceOps.length);

    // Deleting the source side regenerates it as a fresh pair; any
    // surviving old mirror remains as an ordinary unlinked operation.
    const latestSource = sourceOps[sourceOps.length - 1];
    await deletePairedOperation(latestSource.id);
    await catchUp.catchUp(owner.id);
    const regeneratedSource = await operationsFor(s.id, source.id);
    expect(regeneratedSource).toHaveLength(sourceOps.length);
    const regeneratedMirrors = await operationsFor(s.id, target.id);
    expect(regeneratedMirrors).toHaveLength(mirrorOps.length);
  });

  it('skips generation while the transfer target is closed, resumes once unlinked', async () => {
    const { owner, account: source } =
      await createOwnedAccount('gen6@example.com');
    const [target] = await ctx.db
      .insert(account)
      .values({ bankId: source.bankId, name: 'Savings', currency: 'USD' })
      .returning();
    await ctx.db
      .update(account)
      .set({ closed: true })
      .where(eq(account.id, target.id));
    const s = await insertScheduler({
      accountId: source.id,
      paymentMethodId: 4,
      transferAccountId: target.id,
      valueDate: '2025-11-01',
    });

    await catchUp.catchUp(owner.id);
    expect(await operationsFor(s.id)).toHaveLength(0);

    // Unlink by switching to a non-transfer payment method (server nulls
    // the stored transfer account whenever the method isn't Transfer).
    const { token, cookies } = await authedRequest(
      'gen6@example.com',
      'password1',
    );
    await request(app.getHttpServer())
      .patch(`/schedulers/${s.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        accountId: source.id,
        type: 'debit',
        thirdParty: 'Landlord',
        amount: 900,
        paymentMethodId: 2,
        valueDate: '2025-11-01',
        frequencyValue: 1,
      })
      .expect(200);

    expect((await operationsFor(s.id)).length).toBeGreaterThanOrEqual(3);
  });

  it('account soft-delete converts the scheduler transfer reference to External and resumes generation', async () => {
    const { owner, account: source } =
      await createOwnedAccount('gen7@example.com');
    // Signs in first, while there's nothing to catch up on yet — avoids the
    // sign-in trigger generating (correctly, with the target still active)
    // before this test gets to exercise the soft-delete conversion below.
    const { token, cookies } = await authedRequest(
      'gen7@example.com',
      'password1',
    );

    const [target] = await ctx.db
      .insert(account)
      .values({ bankId: source.bankId, name: 'Savings', currency: 'USD' })
      .returning();
    const s = await insertScheduler({
      accountId: source.id,
      paymentMethodId: 4,
      transferAccountId: target.id,
      valueDate: '2025-11-01',
    });

    await request(app.getHttpServer())
      .delete(`/accounts/${target.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .expect(200);

    const [refreshed] = await ctx.db
      .select()
      .from(scheduler)
      .where(eq(scheduler.id, s.id));
    expect(refreshed.transferAccountId).toBeNull();

    await catchUp.catchUp(owner.id);
    const ops = await operationsFor(s.id);
    expect(ops.length).toBeGreaterThanOrEqual(3);
    expect(ops.every((o) => o.accountId === source.id)).toBe(true);
  });

  it('nothing generates when the limit date is before the first due date', async () => {
    const { owner, account: acc } =
      await createOwnedAccount('gen8@example.com');
    const s = await insertScheduler({
      accountId: acc.id,
      valueDate: '2030-01-01',
      limitDate: '2029-01-01',
    });

    await catchUp.catchUp(owner.id);
    expect(await operationsFor(s.id)).toHaveLength(0);
  });

  it('is idempotent — running generation twice in a row produces no duplicates', async () => {
    const { owner, account: acc } =
      await createOwnedAccount('gen9@example.com');
    const s = await insertScheduler({
      accountId: acc.id,
      valueDate: '2025-06-01',
    });

    await catchUp.catchUp(owner.id);
    const first = await operationsFor(s.id);
    await catchUp.catchUp(owner.id);
    const second = await operationsFor(s.id);

    expect(second).toHaveLength(first.length);
  });
});

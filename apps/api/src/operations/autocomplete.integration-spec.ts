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

describe('operations autocomplete (integration)', () => {
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
    return getCsrfTokenAndCookies(authCookies);
  }

  async function insertBank(
    memberId: number,
    overrides: { deleted?: boolean } = {},
  ) {
    const [row] = await ctx.db
      .insert(bank)
      .values({
        memberId,
        name: `Bank ${memberId}-${Math.random()}`,
        deleted: overrides.deleted ?? false,
      })
      .returning();
    return row;
  }

  async function insertAccount(
    bankId: number,
    overrides: { deleted?: boolean } = {},
  ) {
    const [row] = await ctx.db
      .insert(account)
      .values({
        bankId,
        name: 'Checking',
        currency: 'USD',
        deleted: overrides.deleted ?? false,
      })
      .returning();
    return row;
  }

  type OpOverrides = Partial<{
    thirdParty: string;
    categoryId: number;
    paymentMethodId: number;
    debit: number | null;
    credit: number | null;
    valueDate: string;
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
      })
      .returning();
    return row;
  }

  it('rejects a query under 2 characters', async () => {
    const owner = await createMember('auto1@example.com', 'password1');
    const ownerBank = await insertBank(owner.id);
    await insertAccount(ownerBank.id);
    const { token, cookies } = await authedRequest(
      'auto1@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .get('/operations/autocomplete?q=g')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(400);
  });

  it('matches on a contains basis, case-insensitive', async () => {
    const owner = await createMember('auto2@example.com', 'password1');
    const ownerBank = await insertBank(owner.id);
    const acc = await insertAccount(ownerBank.id);
    await insertOperation(acc.id, {
      thirdParty: 'Grocery Store',
      categoryId: 6,
      valueDate: '2026-01-10',
    });
    const { token, cookies } = await authedRequest(
      'auto2@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .get('/operations/autocomplete?q=gro')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(200);
    const body = res.body as {
      thirdParty: string;
      categoryId: number | null;
    }[];
    expect(body).toHaveLength(1);
    expect(body[0]).toEqual({ thirdParty: 'Grocery Store', categoryId: 6 });
  });

  it('returns the category of the latest-value-date operation per third party', async () => {
    const owner = await createMember('auto3@example.com', 'password1');
    const ownerBank = await insertBank(owner.id);
    const acc = await insertAccount(ownerBank.id);
    await insertOperation(acc.id, {
      thirdParty: 'Grocery Store',
      categoryId: 6,
      valueDate: '2026-01-01',
    });
    await insertOperation(acc.id, {
      thirdParty: 'Grocery Store',
      categoryId: 7,
      valueDate: '2026-02-15',
    });
    const { token, cookies } = await authedRequest(
      'auto3@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .get('/operations/autocomplete?q=grocery')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(200);
    const body = res.body as {
      thirdParty: string;
      categoryId: number | null;
    }[];
    expect(body).toHaveLength(1);
    expect(body[0].categoryId).toBe(7);
  });

  it('includes closed accounts but excludes deleted accounts and deleted banks', async () => {
    const owner = await createMember('auto4@example.com', 'password1');
    const activeBank = await insertBank(owner.id);
    const closedAccount = await insertAccount(activeBank.id);
    await ctx.db
      .update(account)
      .set({ closed: true })
      .where(sql`${account.id} = ${closedAccount.id}`);
    await insertOperation(closedAccount.id, {
      thirdParty: 'Closed Account Shop',
      valueDate: '2026-01-01',
    });

    const deletedAccountBank = await insertBank(owner.id);
    const deletedAccount = await insertAccount(deletedAccountBank.id, {
      deleted: true,
    });
    await insertOperation(deletedAccount.id, {
      thirdParty: 'Deleted Account Shop',
      valueDate: '2026-01-01',
    });

    const deletedBank = await insertBank(owner.id, { deleted: true });
    const accountOfDeletedBank = await insertAccount(deletedBank.id);
    await insertOperation(accountOfDeletedBank.id, {
      thirdParty: 'Deleted Bank Shop',
      valueDate: '2026-01-01',
    });

    const { token, cookies } = await authedRequest(
      'auto4@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .get('/operations/autocomplete?q=shop')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(200);
    const body = res.body as { thirdParty: string }[];
    expect(body.map((row) => row.thirdParty)).toEqual(['Closed Account Shop']);
  });

  it('drops a type-mismatched category but keeps the third party', async () => {
    const owner = await createMember('auto5@example.com', 'password1');
    const ownerBank = await insertBank(owner.id);
    const acc = await insertAccount(ownerBank.id);
    await insertOperation(acc.id, {
      thirdParty: 'Grocery Store',
      categoryId: 6, // debit-type category
      valueDate: '2026-01-01',
    });
    const { token, cookies } = await authedRequest(
      'auto5@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .get('/operations/autocomplete?q=grocery&type=credit')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(200);
    const body = res.body as {
      thirdParty: string;
      categoryId: number | null;
    }[];
    expect(body).toHaveLength(1);
    expect(body[0]).toEqual({ thirdParty: 'Grocery Store', categoryId: null });
  });
});

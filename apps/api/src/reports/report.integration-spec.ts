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
import { account, bank, member, report, reportAccount } from '../db/schema';
import { EMAIL_PROVIDER } from '../email/email.constants';
import type { EmailProvider } from '../email/email-message';
import { EmailModule } from '../email/email.module';
import { ReportsModule } from './reports.module';
import { HashService } from '../security/hash.service';
import { SecurityModule } from '../security/security.module';
import { SessionModule } from '../session/session.module';

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

describe('reports (integration)', () => {
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
        ReportsModule,
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
      sql`truncate table ${reportAccount}, ${report}, ${account}, ${bank}, ${member} restart identity cascade`,
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

  let bankCounter = 0;

  async function createOwnedAccount(
    email: string,
    opts: { deleted?: boolean; owner?: { id: number } } = {},
  ) {
    const owner = opts.owner ?? (await createMember(email, 'password1'));
    const [ownerBank] = await ctx.db
      .insert(bank)
      .values({ memberId: owner.id, name: `Bank ${++bankCounter}` })
      .returning();
    const [acc] = await ctx.db
      .insert(account)
      .values({
        bankId: ownerBank.id,
        name: 'Checking',
        currency: 'USD',
        deleted: opts.deleted ?? false,
      })
      .returning();
    return { owner, bank: ownerBank, account: acc };
  }

  it('creates a report with a linked account selection', async () => {
    const { account: acc } = await createOwnedAccount('rep1@example.com');
    const { token, cookies } = await authedRequest(
      'rep1@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/reports')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        type: 'sum',
        title: 'Monthly overview',
        periodGrouping: 'month',
        accountIds: [acc.id],
      });

    expect(res.status).toBe(200);
    const created = (
      res.body as { report: { id: number; accountIds: number[] } }
    ).report;
    expect(created.accountIds).toEqual([acc.id]);

    const links = await ctx.db
      .select()
      .from(reportAccount)
      .where(sql`${reportAccount.reportId} = ${created.id}`);
    expect(links).toHaveLength(1);
  });

  it('drops non-owned and deleted accounts from the submitted selection', async () => {
    const { account: acc, owner } =
      await createOwnedAccount('rep2@example.com');
    const { account: deletedAcc } = await createOwnedAccount(
      'rep2@example.com',
      {
        deleted: true,
        owner,
      },
    );
    const { account: foreignAcc } = await createOwnedAccount(
      'rep2-other@example.com',
    );
    const { token, cookies } = await authedRequest(
      'rep2@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/reports')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        type: 'sum',
        title: 'Filtered selection',
        periodGrouping: 'month',
        accountIds: [acc.id, deletedAcc.id, foreignAcc.id],
      });

    expect(res.status).toBe(200);
    const created = (res.body as { report: { accountIds: number[] } }).report;
    expect(created.accountIds).toEqual([acc.id]);
  });

  it('replaces the account selection wholesale on update, purging deleted links', async () => {
    const { account: acc, owner } =
      await createOwnedAccount('rep3@example.com');
    const { account: acc2 } = await createOwnedAccount('rep3@example.com', {
      owner,
    });
    const [created] = await ctx.db
      .insert(report)
      .values({
        memberId: owner.id,
        type: 'sum',
        title: 'Original',
        periodGrouping: 'month',
      })
      .returning();
    await ctx.db
      .insert(reportAccount)
      .values({ reportId: created.id, accountId: acc.id });
    // Account gets deleted after being linked — must be purged on next save.
    await ctx.db
      .update(account)
      .set({ deleted: true })
      .where(sql`${account.id} = ${acc.id}`);
    const { token, cookies } = await authedRequest(
      'rep3@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .patch(`/reports/${created.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({
        type: 'sum',
        title: 'Updated',
        periodGrouping: 'quarter',
        accountIds: [acc.id, acc2.id],
      });

    expect(res.status).toBe(200);
    const links = await ctx.db
      .select()
      .from(reportAccount)
      .where(sql`${reportAccount.reportId} = ${created.id}`);
    expect(links.map((l) => l.accountId)).toEqual([acc2.id]);
  });

  it('rejects edit and delete on a non-owned report with not-found', async () => {
    const { owner } = await createOwnedAccount('rep4-owner@example.com');
    await createMember('rep4-other@example.com', 'password1');
    const [created] = await ctx.db
      .insert(report)
      .values({
        memberId: owner.id,
        type: 'sum',
        title: 'Private',
        periodGrouping: 'month',
      })
      .returning();
    const { token, cookies } = await authedRequest(
      'rep4-other@example.com',
      'password1',
    );

    const updateRes = await request(app.getHttpServer())
      .patch(`/reports/${created.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ type: 'sum', title: 'Hijacked', periodGrouping: 'month' });
    expect(updateRes.status).toBe(404);

    const deleteRes = await request(app.getHttpServer())
      .delete(`/reports/${created.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');
    expect(deleteRes.status).toBe(404);
  });

  it("lists a member's reports ordered by type then title", async () => {
    const { owner } = await createOwnedAccount('rep5@example.com');
    await ctx.db.insert(report).values([
      {
        memberId: owner.id,
        type: 'sum',
        title: 'B report',
        periodGrouping: 'month',
      },
      {
        memberId: owner.id,
        type: 'average',
        title: 'A report',
        periodGrouping: 'month',
      },
      {
        memberId: owner.id,
        type: 'sum',
        title: 'A report',
        periodGrouping: 'month',
      },
    ]);
    const { cookies } = await authedRequest('rep5@example.com', 'password1');

    const res = await request(app.getHttpServer())
      .get('/reports')
      .set('Cookie', cookies)
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(200);
    const titles = (res.body as { type: string; title: string }[]).map(
      (r) => `${r.type}:${r.title}`,
    );
    expect(titles).toEqual([
      'average:A report',
      'sum:A report',
      'sum:B report',
    ]);
  });

  it('deletes a report and its account links', async () => {
    const { account: acc, owner } =
      await createOwnedAccount('rep6@example.com');
    const [created] = await ctx.db
      .insert(report)
      .values({
        memberId: owner.id,
        type: 'sum',
        title: 'To delete',
        periodGrouping: 'month',
      })
      .returning();
    await ctx.db
      .insert(reportAccount)
      .values({ reportId: created.id, accountId: acc.id });
    const { token, cookies } = await authedRequest(
      'rep6@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .delete(`/reports/${created.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(200);
    const [row] = await ctx.db
      .select()
      .from(report)
      .where(sql`${report.id} = ${created.id}`);
    expect(row).toBeUndefined();
    const links = await ctx.db
      .select()
      .from(reportAccount)
      .where(sql`${reportAccount.reportId} = ${created.id}`);
    expect(links).toHaveLength(0);
  });
});

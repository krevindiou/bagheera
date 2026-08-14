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
import { bank, member } from '../db/schema';
import { EmailModule } from '../email/email.module';
import { EMAIL_PROVIDER } from '../email/email.constants';
import type { EmailProvider } from '../email/email-message';
import { HashService } from '../security/hash.service';
import { SecurityModule } from '../security/security.module';
import { SessionModule } from '../session/session.module';
import { AuthModule } from '../auth/auth.module';
import { BanksModule } from './banks.module';

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

describe('banks (integration)', () => {
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

  it('creates a bank when a new name is given', async () => {
    await createMember('owner1@example.com', 'password1');
    const { token, cookies } = await authedRequest(
      'owner1@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/banks/choice')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ name: 'My New Bank' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'My New Bank', created: true });

    const rows = await ctx.db.select().from(bank);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('My New Bank');
  });

  it('passes through an existing active bank without creating a row', async () => {
    const owner = await createMember('owner2@example.com', 'password1');
    const [existing] = await ctx.db
      .insert(bank)
      .values({ memberId: owner.id, name: 'Existing Bank' })
      .returning();
    const { token, cookies } = await authedRequest(
      'owner2@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/banks/choice')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ bankId: existing.id });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: existing.id,
      name: 'Existing Bank',
      created: false,
    });

    const rows = await ctx.db.select().from(bank);
    expect(rows).toHaveLength(1);
  });

  it('rejects choosing with neither option selected', async () => {
    await createMember('owner3@example.com', 'password1');
    const { token, cookies } = await authedRequest(
      'owner3@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post('/banks/choice')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({});

    expect(res.status).toBe(400);
    expect((res.body as { message: string }).message).toBe(
      'You must select a bank.',
    );
  });

  it('lists non-deleted banks alphabetically', async () => {
    const owner = await createMember('owner4@example.com', 'password1');
    await ctx.db.insert(bank).values([
      { memberId: owner.id, name: 'Zebra Bank' },
      { memberId: owner.id, name: 'Alpha Bank' },
      { memberId: owner.id, name: 'Mid Bank' },
      { memberId: owner.id, name: 'Deleted Bank', deleted: true },
    ]);
    const { token, cookies } = await authedRequest(
      'owner4@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .get('/banks')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(200);
    expect((res.body as { name: string }[]).map((b) => b.name)).toEqual([
      'Alpha Bank',
      'Mid Bank',
      'Zebra Bank',
    ]);
  });

  it('edits an active bank, and rejects editing a closed one', async () => {
    const owner = await createMember('owner5@example.com', 'password1');
    const [active] = await ctx.db
      .insert(bank)
      .values({ memberId: owner.id, name: 'Active Bank' })
      .returning();
    const [closed] = await ctx.db
      .insert(bank)
      .values({ memberId: owner.id, name: 'Closed Bank', closed: true })
      .returning();
    const { token, cookies } = await authedRequest(
      'owner5@example.com',
      'password1',
    );

    const okRes = await request(app.getHttpServer())
      .patch(`/banks/${active.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ name: 'Renamed Bank' });
    expect(okRes.status).toBe(200);
    const [updated] = await ctx.db
      .select()
      .from(bank)
      .where(sql`${bank.id} = ${active.id}`);
    expect(updated.name).toBe('Renamed Bank');

    const failRes = await request(app.getHttpServer())
      .patch(`/banks/${closed.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ name: 'Nope' });
    expect(failRes.status).toBe(422);
  });

  it('closes an active bank and rejects closing it again', async () => {
    const owner = await createMember('owner6@example.com', 'password1');
    const [active] = await ctx.db
      .insert(bank)
      .values({ memberId: owner.id, name: 'To Close' })
      .returning();
    const { token, cookies } = await authedRequest(
      'owner6@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .post(`/banks/${active.id}/close`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(200);
    const [row] = await ctx.db
      .select()
      .from(bank)
      .where(sql`${bank.id} = ${active.id}`);
    expect(row.closed).toBe(true);

    const { token: token2, cookies: cookies2 } =
      await getCsrfTokenAndCookies(cookies);
    const again = await request(app.getHttpServer())
      .post(`/banks/${active.id}/close`)
      .set('Cookie', cookies2)
      .set('x-csrf-token', token2)
      .set('X-Forwarded-Proto', 'https');
    expect(again.status).toBe(422);
  });

  it('deletes any non-deleted bank, including a closed one', async () => {
    const owner = await createMember('owner7@example.com', 'password1');
    const [closed] = await ctx.db
      .insert(bank)
      .values({ memberId: owner.id, name: 'Closed', closed: true })
      .returning();
    const { token, cookies } = await authedRequest(
      'owner7@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .delete(`/banks/${closed.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(200);
    const [row] = await ctx.db
      .select()
      .from(bank)
      .where(sql`${bank.id} = ${closed.id}`);
    expect(row.deleted).toBe(true);

    const { token: token2, cookies: cookies2 } =
      await getCsrfTokenAndCookies(cookies);
    const again = await request(app.getHttpServer())
      .delete(`/banks/${closed.id}`)
      .set('Cookie', cookies2)
      .set('x-csrf-token', token2)
      .set('X-Forwarded-Proto', 'https');
    expect(again.status).toBe(422);
  });

  it('returns not found for a non-owner even when the bank is closed and deleted', async () => {
    const owner = await createMember('owner8@example.com', 'password1');
    await createMember('intruder8@example.com', 'password1');
    const [theirs] = await ctx.db
      .insert(bank)
      .values({
        memberId: owner.id,
        name: 'Not Yours',
        closed: true,
        deleted: true,
      })
      .returning();
    const { token, cookies } = await authedRequest(
      'intruder8@example.com',
      'password1',
    );

    const res = await request(app.getHttpServer())
      .patch(`/banks/${theirs.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ name: 'Hijacked' });
    expect(res.status).toBe(404);

    const del = await request(app.getHttpServer())
      .delete(`/banks/${theirs.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');
    expect(del.status).toBe(404);
  });
});

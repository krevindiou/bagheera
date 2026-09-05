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
import { member, securityEvent, webauthnCredential } from '../db/schema';
import { EmailModule } from '../email/email.module';
import { HashService } from '../security/hash.service';
import { SecurityModule } from '../security/security.module';
import { SessionModule } from '../session/session.module';
import { AuthModule } from '../auth/auth.module';
import { Public } from '../session/public.decorator';
import { WebauthnModule } from './webauthn.module';

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

function mergeCookies(existing: string[], fresh: string[]): string[] {
  return [
    ...existing.filter(
      (c) => !fresh.some((n) => n.split('=')[0] === c.split('=')[0]),
    ),
    ...fresh,
  ];
}

describe('webauthn credentials management (integration)', () => {
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
        WebauthnModule,
      ],
      controllers: [TestCsrfController],
    }).compile();

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
    const fresh = (res.headers['set-cookie'] as unknown as string[]).map(
      cookiePair,
    );
    return {
      token: (res.body as { csrfToken: string }).csrfToken,
      cookies: mergeCookies(existingCookies, fresh),
    };
  }

  async function signInAndGetSession(
    email: string,
    password: string,
  ): Promise<string[]> {
    const { token, cookies } = await getCsrfTokenAndCookies();
    const res = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send({ email, password })
      .expect(200);
    const fresh = (res.headers['set-cookie'] as unknown as string[]).map(
      cookiePair,
    );
    return mergeCookies(cookies, fresh);
  }

  async function createMember(email: string, password: string) {
    const passwordHash = await hash.hash(password);
    const [row] = await ctx.db
      .insert(member)
      .values({ email, password: passwordHash, country: 'FR', active: true })
      .returning();
    return row;
  }

  async function addCredential(
    memberId: number,
    credentialId: string,
    deviceName?: string,
  ) {
    const [row] = await ctx.db
      .insert(webauthnCredential)
      .values({
        memberId,
        credentialId,
        publicKey: Buffer.from([1, 2, 3]).toString('base64'),
        counter: 0,
        deviceName,
      })
      .returning();
    return row;
  }

  it("lists only the signed-in member's own credentials, without the public key", async () => {
    const mine = await createMember('mine@example.com', 'correct-horse');
    const other = await createMember('other@example.com', 'correct-horse');
    await addCredential(mine.id, 'cred-mine', 'My laptop');
    await addCredential(other.id, 'cred-other');

    const authCookies = await signInAndGetSession(
      'mine@example.com',
      'correct-horse',
    );
    const res = await request(app.getHttpServer())
      .get('/webauthn/credentials')
      .set('Cookie', authCookies)
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(200);
    const body = res.body as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0].deviceName).toBe('My laptop');
    expect(body[0].publicKey).toBeUndefined();
    expect(body[0].counter).toBeUndefined();
  });

  it("deletes only the signed-in member's own credential and records the audit event", async () => {
    const mine = await createMember('del@example.com', 'correct-horse');
    const credential = await addCredential(mine.id, 'cred-del');
    const authCookies = await signInAndGetSession(
      'del@example.com',
      'correct-horse',
    );
    const { token, cookies } = await getCsrfTokenAndCookies(authCookies);

    const res = await request(app.getHttpServer())
      .delete(`/webauthn/credentials/${credential.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(200);
    const rows = await ctx.db.select().from(webauthnCredential);
    expect(rows).toHaveLength(0);

    const [event] = await ctx.db
      .select()
      .from(securityEvent)
      .where(sql`${securityEvent.eventType} = 'webauthn_credential_removed'`);
    expect(event.memberId).toBe(mine.id);
  });

  it("404s deleting another member's credential and leaves it untouched", async () => {
    await createMember('attacker@example.com', 'correct-horse');
    const other = await createMember('victim@example.com', 'correct-horse');
    const victimCredential = await addCredential(other.id, 'cred-victim');
    const authCookies = await signInAndGetSession(
      'attacker@example.com',
      'correct-horse',
    );
    const { token, cookies } = await getCsrfTokenAndCookies(authCookies);

    const res = await request(app.getHttpServer())
      .delete(`/webauthn/credentials/${victimCredential.id}`)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https');

    expect(res.status).toBe(404);
    const rows = await ctx.db.select().from(webauthnCredential);
    expect(rows).toHaveLength(1);
  });
});

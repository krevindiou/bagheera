import { Controller, Get, Req, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';
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
import { SESSION_COOKIE_NAME } from '../session/session.constants';
import { SessionModule } from '../session/session.module';
import { AuthModule } from '../auth/auth.module';
import { Public } from '../session/public.decorator';
import { WebauthnModule } from './webauthn.module';

// generateAuthenticationOptions runs for real; only verifyAuthenticationResponse
// is mocked (a real assertion needs a real/virtual authenticator — see the
// Playwright e2e suite for that coverage).
jest.mock('@simplewebauthn/server', () => ({
  ...jest.requireActual<typeof import('@simplewebauthn/server')>(
    '@simplewebauthn/server',
  ),
  verifyAuthenticationResponse: jest.fn(),
}));

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

describe('webauthn authentication (integration)', () => {
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
    jest.mocked(verifyAuthenticationResponse).mockReset();
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

  async function postWithCsrf(
    cookies: string[],
    path: string,
    body: object,
  ): Promise<{ res: request.Response; cookies: string[] }> {
    const { token, cookies: withToken } = await getCsrfTokenAndCookies(cookies);
    const res = await request(app.getHttpServer())
      .post(path)
      .set('Cookie', withToken)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send(body);
    const fresh =
      (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
    return { res, cookies: mergeCookies(withToken, fresh.map(cookiePair)) };
  }

  async function createMember(email: string, password: string) {
    const passwordHash = await hash.hash(password);
    const [row] = await ctx.db
      .insert(member)
      .values({ email, password: passwordHash, country: 'FR', active: true })
      .returning();
    return row;
  }

  async function addCredential(memberId: number, credentialId: string) {
    await ctx.db.insert(webauthnCredential).values({
      memberId,
      credentialId,
      publicKey: Buffer.from([1, 2, 3]).toString('base64'),
      counter: 0,
    });
  }

  const responseFor = (id: string) => ({
    id,
    rawId: id,
    response: {},
    clientExtensionResults: {},
    type: 'public-key',
  });

  it('lists the real credential ids in allowCredentials for a known email', async () => {
    const row = await createMember('known@example.com', 'correct-horse');
    await addCredential(row.id, 'cred-1');
    const { cookies } = await getCsrfTokenAndCookies();

    const { res } = await postWithCsrf(
      cookies,
      '/webauthn/authentication/options',
      { email: 'known@example.com' },
    );

    expect(res.status).toBe(200);
    const body = res.body as PublicKeyCredentialRequestOptionsJSON;
    expect(body.allowCredentials).toHaveLength(1);
    expect(body.allowCredentials?.[0].id).toBe('cred-1');
  });

  it('returns an empty allowCredentials, indistinguishably, for an unknown email', async () => {
    const { cookies } = await getCsrfTokenAndCookies();

    const { res } = await postWithCsrf(
      cookies,
      '/webauthn/authentication/options',
      { email: 'nobody@example.com' },
    );

    expect(res.status).toBe(200);
    const body = res.body as PublicKeyCredentialRequestOptionsJSON;
    expect(body.allowCredentials).toHaveLength(0);
  });

  it('rejects a verify call with no prior options call', async () => {
    const { cookies } = await getCsrfTokenAndCookies();

    const { res } = await postWithCsrf(
      cookies,
      '/webauthn/authentication/verify',
      { response: responseFor('cred-1') },
    );

    expect(res.status).toBe(401);
  });

  it('rejects verify for an unknown email exactly like a genuine mismatch, recording no member', async () => {
    const { cookies } = await getCsrfTokenAndCookies();
    const { cookies: afterOptions } = await postWithCsrf(
      cookies,
      '/webauthn/authentication/options',
      { email: 'nobody@example.com' },
    );

    const { res } = await postWithCsrf(
      afterOptions,
      '/webauthn/authentication/verify',
      { response: responseFor('cred-1') },
    );

    expect(res.status).toBe(401);
    const [event] = await ctx.db
      .select()
      .from(securityEvent)
      .where(sql`${securityEvent.eventType} = 'webauthn_sign_in_failure'`);
    expect(event.memberId).toBeNull();
  });

  it('signs in, rotates the session, updates the counter, and records the audit event on success', async () => {
    const row = await createMember('signin@example.com', 'correct-horse');
    await addCredential(row.id, 'cred-1');

    const { cookies } = await getCsrfTokenAndCookies();
    const { cookies: afterOptions } = await postWithCsrf(
      cookies,
      '/webauthn/authentication/options',
      { email: 'signin@example.com' },
    );
    const preVerifySessionCookie = afterOptions.find((c) =>
      c.startsWith(`${SESSION_COOKIE_NAME}=`),
    );

    jest.mocked(verifyAuthenticationResponse).mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 7 },
    } as never);

    const { res, cookies: afterVerify } = await postWithCsrf(
      afterOptions,
      '/webauthn/authentication/verify',
      { response: responseFor('cred-1') },
    );

    expect(res.status).toBe(200);
    const postVerifySessionCookie = afterVerify.find((c) =>
      c.startsWith(`${SESSION_COOKIE_NAME}=`),
    );
    expect(postVerifySessionCookie).not.toBe(preVerifySessionCookie);

    const [updatedMember] = await ctx.db
      .select()
      .from(member)
      .where(sql`${member.id} = ${row.id}`);
    expect(updatedMember.loggedAt).not.toBeNull();

    const [updatedCredential] = await ctx.db
      .select()
      .from(webauthnCredential)
      .where(sql`${webauthnCredential.memberId} = ${row.id}`);
    expect(updatedCredential.counter).toBe(7);
    expect(updatedCredential.lastUsedAt).not.toBeNull();

    const [event] = await ctx.db
      .select()
      .from(securityEvent)
      .where(sql`${securityEvent.eventType} = 'webauthn_sign_in_success'`);
    expect(event.memberId).toBe(row.id);
  });
});

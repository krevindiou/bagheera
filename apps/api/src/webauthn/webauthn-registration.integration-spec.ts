import { Controller, Get, Req, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server';
import { Queue } from 'bullmq';
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
import { EMAIL_PROVIDER, EMAIL_QUEUE } from '../email/email.constants';
import type { EmailMessage, EmailProvider } from '../email/email-message';
import { HashService } from '../security/hash.service';
import { SecurityModule } from '../security/security.module';
import { SessionModule } from '../session/session.module';
import { AuthModule } from '../auth/auth.module';
import { Public } from '../session/public.decorator';
import { WebauthnModule } from './webauthn.module';

// generateRegistrationOptions runs for real (pure, no browser interaction);
// only verifyRegistrationResponse is mocked — a real attestation needs a
// real or virtual authenticator, which is what apps/web's e2e suite covers
// via Playwright's CDP virtual authenticator.
jest.mock('@simplewebauthn/server', () => ({
  ...jest.requireActual<typeof import('@simplewebauthn/server')>(
    '@simplewebauthn/server',
  ),
  verifyRegistrationResponse: jest.fn(),
}));

class FakeEmailProvider implements EmailProvider {
  send(): Promise<void> {
    return Promise.resolve();
  }
}

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

describe('webauthn registration (integration)', () => {
  let app: NestExpressApplication;
  let ctx: IntegrationDb;
  let hash: HashService;
  let emailQueue: Queue<EmailMessage>;

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
    emailQueue = moduleRef.get<Queue<EmailMessage>>(EMAIL_QUEUE);
    ctx = connectIntegrationDb();
  });

  afterAll(async () => {
    await ctx.pool.end();
    await app.close();
  });

  beforeEach(async () => {
    jest.mocked(verifyRegistrationResponse).mockReset();
    await emailQueue.drain();
    await emailQueue.clean(0, 1000, 'completed');
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

  async function postWithCsrf(
    authCookies: string[],
    path: string,
    body: object,
  ) {
    const { token, cookies } = await getCsrfTokenAndCookies(authCookies);
    return request(app.getHttpServer())
      .post(path)
      .set('Cookie', cookies)
      .set('x-csrf-token', token)
      .set('X-Forwarded-Proto', 'https')
      .send(body);
  }

  const dummyResponse = {
    id: 'cred-1',
    rawId: 'cred-1',
    response: {},
    clientExtensionResults: {},
    type: 'public-key',
  };

  it('generates registration options scoped to the signed-in member', async () => {
    await createMember('reg@example.com', 'correct-horse');
    const authCookies = await signInAndGetSession(
      'reg@example.com',
      'correct-horse',
    );

    const res = await postWithCsrf(
      authCookies,
      '/webauthn/registration/options',
      {},
    );

    expect(res.status).toBe(200);
    const body = res.body as PublicKeyCredentialCreationOptionsJSON;
    expect(body.user.name).toBe('reg@example.com');
    expect(body.rp.id).toBe(process.env.RP_ID);
  });

  it('rejects a verify call with no prior options call', async () => {
    await createMember('noreg@example.com', 'correct-horse');
    const authCookies = await signInAndGetSession(
      'noreg@example.com',
      'correct-horse',
    );

    const res = await postWithCsrf(
      authCookies,
      '/webauthn/registration/verify',
      {
        response: dummyResponse,
      },
    );

    expect(res.status).toBe(400);
  });

  it('persists the credential, emails a notice, and records the audit event on success', async () => {
    const row = await createMember('success@example.com', 'correct-horse');
    const authCookies = await signInAndGetSession(
      'success@example.com',
      'correct-horse',
    );
    await postWithCsrf(authCookies, '/webauthn/registration/options', {});

    jest.mocked(verifyRegistrationResponse).mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: 'cred-1',
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 0,
          transports: ['internal'],
        },
      },
    } as never);

    const res = await postWithCsrf(
      authCookies,
      '/webauthn/registration/verify',
      {
        response: dummyResponse,
        deviceName: 'Test device',
      },
    );

    expect(res.status).toBe(200);

    const [credentialRow] = await ctx.db
      .select()
      .from(webauthnCredential)
      .where(sql`${webauthnCredential.memberId} = ${row.id}`);
    expect(credentialRow.credentialId).toBe('cred-1');
    expect(credentialRow.deviceName).toBe('Test device');

    const jobs = await emailQueue.getJobs(['waiting', 'active', 'completed']);
    expect(jobs.some((j) => j.data.subject === 'Bagheera passkey added')).toBe(
      true,
    );

    const [event] = await ctx.db
      .select()
      .from(securityEvent)
      .where(
        sql`${securityEvent.eventType} = 'webauthn_credential_registered'`,
      );
    expect(event.memberId).toBe(row.id);
  });

  it('rejects and persists nothing when verification is unverified', async () => {
    await createMember('fail@example.com', 'correct-horse');
    const authCookies = await signInAndGetSession(
      'fail@example.com',
      'correct-horse',
    );
    await postWithCsrf(authCookies, '/webauthn/registration/options', {});

    jest
      .mocked(verifyRegistrationResponse)
      .mockResolvedValue({ verified: false } as never);

    const res = await postWithCsrf(
      authCookies,
      '/webauthn/registration/verify',
      {
        response: dummyResponse,
      },
    );

    expect(res.status).toBe(400);
    const rows = await ctx.db.select().from(webauthnCredential);
    expect(rows).toHaveLength(0);
  });
});

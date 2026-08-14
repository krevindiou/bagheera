import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  connectIntegrationDb,
  IntegrationDb,
} from '../db/test-utils/integration-db';
import { DbModule } from '../db/db.module';
import { member } from '../db/schema';
import { EmailModule } from '../email/email.module';
import { EMAIL_PROVIDER, EMAIL_QUEUE } from '../email/email.constants';
import type { EmailMessage, EmailProvider } from '../email/email-message';
import { SecurityModule } from '../security/security.module';
import { CryptoService } from '../security/crypto.service';
import { buildActivationToken } from './activation-token';
import { ActivationService } from './activation.service';
import { MembersModule } from './members.module';

class FakeEmailProvider implements EmailProvider {
  send(): Promise<void> {
    return Promise.resolve();
  }
}

describe('activation (integration)', () => {
  let app: INestApplication<App>;
  let ctx: IntegrationDb;
  let crypto: CryptoService;
  let emailQueue: Queue<EmailMessage>;
  let activationService: ActivationService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DbModule,
        SecurityModule,
        EmailModule,
        MembersModule,
      ],
    })
      .overrideProvider(EMAIL_PROVIDER)
      .useValue(new FakeEmailProvider())
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    crypto = moduleRef.get(CryptoService);
    emailQueue = moduleRef.get<Queue<EmailMessage>>(EMAIL_QUEUE);
    activationService = moduleRef.get(ActivationService);
    ctx = connectIntegrationDb();
  });

  afterAll(async () => {
    await ctx.pool.end();
    await app.close();
  });

  beforeEach(async () => {
    await emailQueue.drain();
    await emailQueue.clean(0, 1000, 'completed');
    await ctx.db.execute(
      sql`truncate table ${member} restart identity cascade`,
    );
  });

  async function createInactiveMember(email: string) {
    const [row] = await ctx.db
      .insert(member)
      .values({ email, password: 'hash', country: 'FR' })
      .returning();
    return row;
  }

  it('activates the member with a valid token', async () => {
    const row = await createInactiveMember('valid@example.com');
    const token = buildActivationToken(
      crypto,
      row.email,
      row.activationTokenVersion,
    );

    const res = await request(app.getHttpServer())
      .post('/members/activate')
      .send({ key: token });

    expect(res.status).toBe(200);
    const [updated] = await ctx.db
      .select()
      .from(member)
      .where(sql`${member.id} = ${row.id}`);
    expect(updated.active).toBe(true);
  });

  it('rejects an expired token', async () => {
    const row = await createInactiveMember('expired@example.com');
    const expiredToken = crypto.encrypt(
      JSON.stringify({
        type: 'register',
        email: row.email,
        version: row.activationTokenVersion,
        exp: Date.now() - 1000,
      }),
    );

    const res = await request(app.getHttpServer())
      .post('/members/activate')
      .send({ key: expiredToken });

    expect(res.status).toBe(400);
    const [unchanged] = await ctx.db
      .select()
      .from(member)
      .where(sql`${member.id} = ${row.id}`);
    expect(unchanged.active).toBe(false);
  });

  it('rejects a malformed token', async () => {
    const res = await request(app.getHttpServer())
      .post('/members/activate')
      .send({ key: 'not-a-real-token' });

    expect(res.status).toBe(400);
  });

  it('rejects a token for an already-active member', async () => {
    const row = await createInactiveMember('active@example.com');
    const token = buildActivationToken(
      crypto,
      row.email,
      row.activationTokenVersion,
    );
    await ctx.db
      .update(member)
      .set({ active: true })
      .where(sql`${member.id} = ${row.id}`);

    const res = await request(app.getHttpServer())
      .post('/members/activate')
      .send({ key: token });

    expect(res.status).toBe(400);
  });

  it('rejects a token issued under a stale version', async () => {
    const row = await createInactiveMember('stale@example.com');
    const staleToken = buildActivationToken(
      crypto,
      row.email,
      row.activationTokenVersion,
    );
    // Bump the stored version behind the token's back (as a reissue would).
    await ctx.db
      .update(member)
      .set({ activationTokenVersion: row.activationTokenVersion + 1 })
      .where(sql`${member.id} = ${row.id}`);

    const res = await request(app.getHttpServer())
      .post('/members/activate')
      .send({ key: staleToken });

    expect(res.status).toBe(400);
    const [unchanged] = await ctx.db
      .select()
      .from(member)
      .where(sql`${member.id} = ${row.id}`);
    expect(unchanged.active).toBe(false);
  });

  it('reissue bumps the version, invalidating the prior token, and enqueues a fresh one', async () => {
    const row = await createInactiveMember('resend@example.com');
    const originalToken = buildActivationToken(
      crypto,
      row.email,
      row.activationTokenVersion,
    );

    await activationService.reissue(row.email);

    const [updated] = await ctx.db
      .select()
      .from(member)
      .where(sql`${member.id} = ${row.id}`);
    expect(updated.activationTokenVersion).toBe(row.activationTokenVersion + 1);

    // The original token, minted under the old version, no longer works.
    const staleRes = await request(app.getHttpServer())
      .post('/members/activate')
      .send({ key: originalToken });
    expect(staleRes.status).toBe(400);

    // A fresh activation job was enqueued.
    const jobs = await emailQueue.getJobs(['waiting', 'active', 'completed']);
    const reissued = jobs.filter((j) => j.data.to === 'resend@example.com');
    expect(reissued).toHaveLength(1);

    // The newly issued token (current version) does activate.
    const freshToken = buildActivationToken(
      crypto,
      row.email,
      updated.activationTokenVersion,
    );
    const okRes = await request(app.getHttpServer())
      .post('/members/activate')
      .send({ key: freshToken });
    expect(okRes.status).toBe(200);
  });

  it('reissue silently no-ops for an unknown email', async () => {
    await expect(
      activationService.reissue('nobody@example.com'),
    ).resolves.toBeUndefined();
  });

  it('reissue silently no-ops for an already-active member', async () => {
    const row = await createInactiveMember('alreadyactive@example.com');
    await ctx.db
      .update(member)
      .set({ active: true })
      .where(sql`${member.id} = ${row.id}`);

    await activationService.reissue(row.email);

    const [unchanged] = await ctx.db
      .select()
      .from(member)
      .where(sql`${member.id} = ${row.id}`);
    expect(unchanged.activationTokenVersion).toBe(row.activationTokenVersion);
  });
});

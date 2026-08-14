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
import { HashService } from '../security/hash.service';
import { SecurityModule } from '../security/security.module';
import { MembersModule } from './members.module';

class FakeEmailProvider implements EmailProvider {
  send(): Promise<void> {
    return Promise.resolve();
  }
}

describe('resend-activation (integration)', () => {
  let app: INestApplication<App>;
  let ctx: IntegrationDb;
  let hash: HashService;
  let emailQueue: Queue<EmailMessage>;

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

    hash = moduleRef.get(HashService);
    emailQueue = moduleRef.get<Queue<EmailMessage>>(EMAIL_QUEUE);
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

  async function createMember(opts: {
    email: string;
    password: string;
    active: boolean;
  }) {
    const passwordHash = await hash.hash(opts.password);
    const [row] = await ctx.db
      .insert(member)
      .values({
        email: opts.email,
        password: passwordHash,
        country: 'FR',
        active: opts.active,
      })
      .returning();
    return row;
  }

  it('reissues the activation token for correct credentials against an inactive member', async () => {
    const row = await createMember({
      email: 'inactive@example.com',
      password: 'correct-horse',
      active: false,
    });

    const res = await request(app.getHttpServer())
      .post('/members/resend-activation')
      .send({ email: 'inactive@example.com', password: 'correct-horse' });

    expect(res.status).toBe(200);
    const [updated] = await ctx.db
      .select()
      .from(member)
      .where(sql`${member.id} = ${row.id}`);
    expect(updated.activationTokenVersion).toBe(row.activationTokenVersion + 1);

    const jobs = await emailQueue.getJobs(['waiting', 'active', 'completed']);
    expect(
      jobs.filter((j) => j.data.to === 'inactive@example.com'),
    ).toHaveLength(1);
  });

  it('rejects the wrong password without reissuing anything', async () => {
    const row = await createMember({
      email: 'wrongpass@example.com',
      password: 'correct-horse',
      active: false,
    });

    const res = await request(app.getHttpServer())
      .post('/members/resend-activation')
      .send({ email: 'wrongpass@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
    const [unchanged] = await ctx.db
      .select()
      .from(member)
      .where(sql`${member.id} = ${row.id}`);
    expect(unchanged.activationTokenVersion).toBe(row.activationTokenVersion);
  });

  it('rejects an unknown email with the identical generic error', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/members/resend-activation')
      .send({ email: 'nobody@example.com', password: 'whatever123' });

    expect(wrongPassword.status).toBe(401);
    expect((wrongPassword.body as { message: string }).message).toBe(
      'Invalid email or password',
    );
  });

  it('no-ops for correct credentials against an already-active member', async () => {
    const row = await createMember({
      email: 'active@example.com',
      password: 'correct-horse',
      active: true,
    });

    const res = await request(app.getHttpServer())
      .post('/members/resend-activation')
      .send({ email: 'active@example.com', password: 'correct-horse' });

    expect(res.status).toBe(200);
    const [unchanged] = await ctx.db
      .select()
      .from(member)
      .where(sql`${member.id} = ${row.id}`);
    expect(unchanged.activationTokenVersion).toBe(row.activationTokenVersion);
  });
});

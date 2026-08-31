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
import { MembersModule } from './members.module';

class FakeEmailProvider implements EmailProvider {
  sent: EmailMessage[] = [];
  send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
}

describe('registration (integration)', () => {
  let app: INestApplication<App>;
  let ctx: IntegrationDb;
  let fakeEmail: FakeEmailProvider;
  let emailQueue: Queue<EmailMessage>;

  beforeAll(async () => {
    fakeEmail = new FakeEmailProvider();

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
      .useValue(fakeEmail)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    emailQueue = moduleRef.get<Queue<EmailMessage>>(EMAIL_QUEUE);
    ctx = connectIntegrationDb();
  });

  afterAll(async () => {
    await ctx.pool.end();
    await app.close();
  });

  beforeEach(async () => {
    fakeEmail.sent = [];
    await emailQueue.drain();
    await emailQueue.clean(0, 1000, 'completed');
    await ctx.db.execute(
      sql`truncate table ${member} restart identity cascade`,
    );
  });

  it('creates an inactive member with a hashed password and enqueues the activation email', async () => {
    const res = await request(app.getHttpServer())
      .post('/members/register')
      .send({
        email: 'newmember@example.com',
        country: 'FR',
        password: 'correct-horse',
        passwordConfirmation: 'correct-horse',
      });

    expect(res.status).toBe(201);

    const [row] = await ctx.db.select().from(member);
    expect(row.email).toBe('newmember@example.com');
    expect(row.active).toBe(false);
    expect(row.password).not.toBe('correct-horse');
    expect(row.password.length).toBeGreaterThan(20);

    // Delivery itself is exercised by the worker (a real BullMQ consumer,
    // background/async by design); here we assert the job that triggers it
    // was actually enqueued, with the right content.
    const jobs = await emailQueue.getJobs(['waiting', 'active', 'completed']);
    const activationJobs = jobs.filter(
      (j) => j.data.to === 'newmember@example.com',
    );
    expect(activationJobs).toHaveLength(1);
    expect(activationJobs[0].data.subject).toBe('Bagheera registration');
    expect(activationJobs[0].data.html).toContain('activate your account');
  });

  it('silently no-ops for an already-registered email (no enumeration)', async () => {
    await ctx.db.insert(member).values({
      email: 'existing@example.com',
      password: 'hash',
      country: 'FR',
    });

    const res = await request(app.getHttpServer())
      .post('/members/register')
      .send({
        email: 'Existing@Example.com',
        country: 'FR',
        password: 'correct-horse',
        passwordConfirmation: 'correct-horse',
      });

    // Same 201/generic response as a genuinely new registration — the
    // caller can't distinguish this from success.
    expect(res.status).toBe(201);
    const rows = await ctx.db.select().from(member);
    expect(rows).toHaveLength(1);
    expect(rows[0].password).toBe('hash'); // untouched, no re-registration
    const jobs = await emailQueue.getJobs(['waiting', 'active', 'completed']);
    expect(jobs).toHaveLength(0); // no activation email re-sent
  });

  it('rejects an invalid email', async () => {
    const res = await request(app.getHttpServer())
      .post('/members/register')
      .send({
        email: 'not-an-email',
        country: 'FR',
        password: 'correct-horse',
        passwordConfirmation: 'correct-horse',
      });

    expect(res.status).toBe(400);
  });

  it('rejects mismatched passwords', async () => {
    const res = await request(app.getHttpServer())
      .post('/members/register')
      .send({
        email: 'mismatch@example.com',
        country: 'FR',
        password: 'correct-horse',
        passwordConfirmation: 'something-else',
      });

    expect(res.status).toBe(400);
    const rows = await ctx.db.select().from(member);
    expect(rows).toHaveLength(0);
  });
});

import { INestApplication } from '@nestjs/common';
import type { Worker } from 'bullmq';
import type { Server } from 'http';
import { inArray } from 'drizzle-orm';
import request from 'supertest';
import { SIGN_IN_CATCH_UP_BUDGET } from '../auth/scheduler-catch-up.service';
import { toMinorUnits } from '../common/money';
import { operation, scheduler } from '../db/schema';
import { PAYMENT_METHOD_ID } from '../db/seed-data';
import {
  insertMemberWithCredential,
  seedSignedInMember,
  signInWithPasskey,
  SignedInFixture,
} from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';
import { insertAccount, insertBank } from '../test-support/db-fixtures';
import { waitForSchedulerGeneration } from '../test-support/wait-for-scheduler-generation';
import { GENERATION_WORKER } from './generation-queue.service';
import { SchedulerGenerationService } from './generation.service';

async function createBank(mutate: SignedInFixture['mutate']): Promise<string> {
  const res = await mutate('post', '/banks/choice', { name: 'Test bank' });
  return (res.body as { id: string }).id;
}

async function createAccount(mutate: SignedInFixture['mutate'], bankId: string): Promise<string> {
  const res = await mutate('post', '/accounts', {
    bankId,
    name: 'Account',
    currency: 'EUR',
  });
  return (res.body as { account: { id: string } }).account.id;
}

// The same "today" generation itself uses (UTC).
function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

describe('scheduler occurrence generation', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  function generatedFor(schedulerIds: string[]) {
    return getDb(app).select().from(operation).where(inArray(operation.schedulerId, schedulerIds));
  }

  // Runs `body` with the generation worker paused, so a test can look at
  // what the request itself did before any queued job gets to run.
  async function withWorkerPaused(body: () => Promise<void>): Promise<void> {
    const worker = app.get<Worker>(GENERATION_WORKER);
    await worker.pause();
    try {
      await body();
    } finally {
      await worker.resume();
    }
  }

  // A member (with a passkey) owning one account, straight in the database.
  async function memberWithAccount() {
    const db = getDb(app);
    const fixture = await insertMemberWithCredential(app);
    const bank = await insertBank(db, fixture.memberId);
    const account = await insertAccount(db, bank.id);
    return { ...fixture, accountId: account.id };
  }

  async function insertScheduler(
    accountId: string,
    overrides: Partial<typeof scheduler.$inferInsert> = {},
  ): Promise<string> {
    const [row] = await getDb(app)
      .insert(scheduler)
      .values({
        accountId,
        thirdParty: 'Direct-insert rent',
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        debit: toMinorUnits(50),
        valueDate: '2024-01-01',
        frequencyValue: 1,
        frequencyUnit: 'month',
        active: true,
        ...overrides,
      })
      .returning({ id: scheduler.id });
    return row.id;
  }

  it('generates every due monthly occurrence from a far-past value date up to today, and is idempotent on re-save', async () => {
    const { mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountId = await createAccount(mutate, bankId);

    const created = await mutate('post', '/schedulers', {
      accountId,
      type: 'debit',
      thirdParty: 'Rent',
      amount: 50,
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      valueDate: '2024-01-01',
      frequencyValue: 1,
      frequencyUnit: 'month',
    });
    const { id } = (created.body as { scheduler: { id: string } }).scheduler;
    await waitForSchedulerGeneration(app);

    const generated = await generatedFor([id]);
    // At least 2024-01-01 through the most recent monthly occurrence —
    // comfortably more than a handful given the fixed 2024-01-01 anchor.
    expect(generated.length).toBeGreaterThan(10);
    const dates = new Set(generated.map((row) => row.valueDate));
    expect(dates.size).toBe(generated.length);

    // Re-saving with no date/interval change re-runs generation, which
    // must be a no-op — `after` already covers every due date.
    const resave = await mutate('patch', `/schedulers/${id}`, {
      accountId,
      type: 'debit',
      thirdParty: 'Rent (renamed)',
      amount: 50,
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      valueDate: '2024-01-01',
      frequencyValue: 1,
      frequencyUnit: 'month',
    });
    expect(resave.status).toBe(200);
    await waitForSchedulerGeneration(app);

    expect(await generatedFor([id])).toHaveLength(generated.length);
  });

  it('never generates for an inactive scheduler', async () => {
    const { mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountId = await createAccount(mutate, bankId);

    const created = await mutate('post', '/schedulers', {
      accountId,
      type: 'debit',
      thirdParty: 'Rent',
      amount: 50,
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      valueDate: '2024-01-01',
      frequencyValue: 1,
      frequencyUnit: 'month',
      active: false,
    });
    const { id } = (created.body as { scheduler: { id: string } }).scheduler;
    await waitForSchedulerGeneration(app);

    expect(await generatedFor([id])).toHaveLength(0);
  });

  // M5: a save used to insert up to a thousand operations (two thousand
  // with a transfer) while the request waited.
  it('leaves generation to the queued job, off the request path', async () => {
    const { mutate } = await seedSignedInMember(app);
    const accountId = await createAccount(mutate, await createBank(mutate));
    let id = '';

    await withWorkerPaused(async () => {
      const created = await mutate('post', '/schedulers', {
        accountId,
        type: 'debit',
        thirdParty: 'Rent',
        amount: 50,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        valueDate: '2024-01-01',
        frequencyValue: 1,
        frequencyUnit: 'month',
      });
      expect(created.status).toBe(200);
      id = (created.body as { scheduler: { id: string } }).scheduler.id;
      expect(await generatedFor([id])).toHaveLength(0);
    });
    await waitForSchedulerGeneration(app);

    expect((await generatedFor([id])).length).toBeGreaterThan(10);
  });

  it('generates a backlog as a side effect of signing in, not just of saving the scheduler', async () => {
    // Inserted directly — bypassing POST /schedulers entirely, so no save
    // ever queues a job for it; only sign-in's catch-up can generate this.
    const { credentialId, accountId } = await memberWithAccount();
    const id = await insertScheduler(accountId);

    await signInWithPasskey(app, request.agent(app.getHttpServer()), credentialId);

    // Well within SIGN_IN_CATCH_UP_BUDGET, so done before sign-in returns.
    expect((await generatedFor([id])).length).toBeGreaterThan(0);
  });

  it('catches a sign-in up only to SIGN_IN_CATCH_UP_BUDGET right away, and queues the rest', async () => {
    const { credentialId, accountId } = await memberWithAccount();
    const dueCount = SIGN_IN_CATCH_UP_BUDGET + 50;
    const id = await insertScheduler(accountId, {
      valueDate: isoDaysAgo(dueCount - 1),
      frequencyUnit: 'day',
    });

    await withWorkerPaused(async () => {
      await signInWithPasskey(app, request.agent(app.getHttpServer()), credentialId);
      expect(await generatedFor([id])).toHaveLength(SIGN_IN_CATCH_UP_BUDGET);
    });
    await waitForSchedulerGeneration(app);

    const generated = await generatedFor([id]);
    expect(generated).toHaveLength(dueCount);
    expect(new Set(generated.map((row) => row.valueDate)).size).toBe(dueCount);
  });

  // Without the per-scheduler lock, both runs resume after the same latest
  // occurrence (none) and insert every due date twice.
  it('never generates the same occurrence twice when two runs overlap', async () => {
    const { accountId } = await memberWithAccount();
    const id = await insertScheduler(accountId);
    const generation = app.get(SchedulerGenerationService);

    const [first, second] = await Promise.all([
      generation.runForScheduler(id),
      generation.runForScheduler(id),
    ]);

    const generated = await generatedFor([id]);
    expect(first + second).toBe(generated.length);
    expect(new Set(generated.map((row) => row.valueDate)).size).toBe(generated.length);
  });

  it("shares one budget across all of a member's schedulers, saying when it ran out", async () => {
    const { memberId, accountId } = await memberWithAccount();
    const ids = [await insertScheduler(accountId), await insertScheduler(accountId)];
    const generation = app.get(SchedulerGenerationService);

    expect(await generation.catchUpMember(memberId, 5)).toBe(true);
    expect(await generatedFor(ids)).toHaveLength(5);

    expect(await generation.catchUpMember(memberId)).toBe(false);
    const perScheduler = (await generatedFor([ids[0]])).length;
    expect(await generatedFor(ids)).toHaveLength(2 * perScheduler);
  });
});

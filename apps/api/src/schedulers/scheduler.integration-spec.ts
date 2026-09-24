import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { eq } from 'drizzle-orm';
import { operation, scheduler } from '../db/schema';
import { PAYMENT_METHOD_ID } from '../db/seed-data';
import { seedSignedInMember, SignedInFixture } from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';
import { waitForSchedulerGeneration } from '../test-support/wait-for-scheduler-generation';

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

function schedulerPayload(accountId: string, overrides: Record<string, unknown> = {}) {
  return {
    accountId,
    type: 'debit',
    thirdParty: 'Rent',
    amount: 50,
    paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
    valueDate: '2099-01-01',
    frequencyValue: 1,
    frequencyUnit: 'month',
    ...overrides,
  };
}

describe('schedulers', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /schedulers', () => {
    it('creates a scheduler with no immediate occurrence when the value date is in the future', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);

      const res = await mutate('post', '/schedulers', schedulerPayload(accountId));
      expect(res.status).toBe(200);
      const { scheduler: created } = res.body as {
        scheduler: { id: string };
      };
      await waitForSchedulerGeneration(app);

      const generated = await getDb(app)
        .select()
        .from(operation)
        .where(eq(operation.schedulerId, created.id));
      expect(generated).toHaveLength(0);
    });

    // Queued since M5 — no longer inserted while the request waits.
    it('generates the due occurrences once the queued job runs, when the value date is today or earlier', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);

      const res = await mutate(
        'post',
        '/schedulers',
        schedulerPayload(accountId, { valueDate: '2020-01-01' }),
      );
      const { scheduler: created } = res.body as {
        scheduler: { id: string };
      };
      await waitForSchedulerGeneration(app);

      const generated = await getDb(app)
        .select()
        .from(operation)
        .where(eq(operation.schedulerId, created.id));
      expect(generated.length).toBeGreaterThan(0);
    });

    it('rejects a frequencyValue beyond the DTO cap (726f0aed regression)', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);

      const res = await mutate(
        'post',
        '/schedulers',
        schedulerPayload(accountId, { frequencyValue: 101 }),
      );
      expect(res.status).toBe(400);
    });

    // Same rule as an operation's own value date (see
    // operation.integration-spec.ts) — a scheduler dated back to year 1
    // would otherwise also seed its own run of out-of-range occurrences.
    it.each([{ valueDate: '0001-01-01' }, { limitDate: '9999-12-31' }])(
      'rejects %o with a 400, storing nothing',
      async (dates) => {
        const { mutate } = await seedSignedInMember(app);
        const bankId = await createBank(mutate);
        const accountId = await createAccount(mutate, bankId);

        const res = await mutate('post', '/schedulers', schedulerPayload(accountId, dates));
        expect(res.status).toBe(400);
        const rows = await getDb(app)
          .select()
          .from(scheduler)
          .where(eq(scheduler.accountId, accountId));
        expect(rows).toEqual([]);
      },
    );

    it('rejects a mismatched payment method type', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);

      const res = await mutate(
        'post',
        '/schedulers',
        schedulerPayload(accountId, {
          type: 'credit',
          paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        }),
      );
      expect(res.status).toBe(400);
    });

    it("404s creating a scheduler under another member's account", async () => {
      const { mutate: ownerMutate } = await seedSignedInMember(app);
      const bankId = await createBank(ownerMutate);
      const accountId = await createAccount(ownerMutate, bankId);

      const { mutate: attackerMutate } = await seedSignedInMember(app);
      const res = await attackerMutate('post', '/schedulers', schedulerPayload(accountId));
      expect(res.status).toBe(404);
    });
  });

  describe('GET /schedulers', () => {
    it('paginates and 404s for a foreign account', async () => {
      const { agent, mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);
      await mutate('post', '/schedulers', schedulerPayload(accountId));

      const res = await agent.get(`/schedulers?accountId=${accountId}&page=1`).expect(200);
      const body = res.body as { total: number };
      expect(body.total).toBe(1);

      const { agent: attackerAgent } = await seedSignedInMember(app);
      await attackerAgent.get(`/schedulers?accountId=${accountId}&page=1`).expect(404);
    });
  });

  describe('PATCH /schedulers/:id', () => {
    it('re-triggers generation when an edit brings an occurrence into range', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);
      const created = await mutate('post', '/schedulers', schedulerPayload(accountId));
      const { id } = (created.body as { scheduler: { id: string } }).scheduler;
      await waitForSchedulerGeneration(app);

      const before = await getDb(app).select().from(operation).where(eq(operation.schedulerId, id));
      expect(before).toHaveLength(0);

      const res = await mutate(
        'patch',
        `/schedulers/${id}`,
        schedulerPayload(accountId, { valueDate: '2020-01-01' }),
      );
      expect(res.status).toBe(200);
      await waitForSchedulerGeneration(app);

      const after = await getDb(app).select().from(operation).where(eq(operation.schedulerId, id));
      expect(after.length).toBeGreaterThan(0);
    });

    it('rejects moving a scheduler to a different account', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);
      const otherAccountId = await createAccount(mutate, bankId);
      const created = await mutate('post', '/schedulers', schedulerPayload(accountId));
      const { id } = (created.body as { scheduler: { id: string } }).scheduler;

      const res = await mutate('patch', `/schedulers/${id}`, schedulerPayload(otherAccountId));
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /schedulers/:id', () => {
    it('deletes the scheduler but leaves generated operations, unlinked', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);
      const created = await mutate(
        'post',
        '/schedulers',
        schedulerPayload(accountId, { valueDate: '2020-01-01' }),
      );
      const { id } = (created.body as { scheduler: { id: string } }).scheduler;
      await waitForSchedulerGeneration(app);
      const [generatedBefore] = await getDb(app)
        .select()
        .from(operation)
        .where(eq(operation.schedulerId, id));
      expect(generatedBefore).toBeDefined();

      const res = await mutate('delete', `/schedulers/${id}`);
      expect(res.status).toBe(200);

      const schedulerRows = await getDb(app).select().from(scheduler).where(eq(scheduler.id, id));
      expect(schedulerRows).toHaveLength(0);

      const [survivor] = await getDb(app)
        .select()
        .from(operation)
        .where(eq(operation.id, generatedBefore.id));
      expect(survivor).toBeDefined();
      expect(survivor.schedulerId).toBeNull();
    });
  });
});

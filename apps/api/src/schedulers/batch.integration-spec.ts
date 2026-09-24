import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, desc, eq } from 'drizzle-orm';
import { operation, scheduler, securityEvent } from '../db/schema';
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

async function createScheduler(
  mutate: SignedInFixture['mutate'],
  accountId: string,
  valueDate = '2099-01-01',
): Promise<string> {
  const res = await mutate('post', '/schedulers', {
    accountId,
    type: 'debit',
    thirdParty: 'Rent',
    amount: 50,
    paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
    valueDate,
    frequencyValue: 1,
    frequencyUnit: 'month',
  });
  return (res.body as { scheduler: { id: string } }).scheduler.id;
}

describe('POST /schedulers/batch/delete', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('deletes only owned ids, unlinks generated operations, and records scheduler_batch_deleted', async () => {
    const { mutate, memberId } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountId = await createAccount(mutate, bankId);
    const ownId = await createScheduler(mutate, accountId, '2020-01-01');
    await waitForSchedulerGeneration(app);
    const [generated] = await getDb(app)
      .select()
      .from(operation)
      .where(eq(operation.schedulerId, ownId));
    expect(generated).toBeDefined();

    const { mutate: otherMutate } = await seedSignedInMember(app);
    const otherBankId = await createBank(otherMutate);
    const otherAccountId = await createAccount(otherMutate, otherBankId);
    const foreignId = await createScheduler(otherMutate, otherAccountId);

    const res = await mutate('post', '/schedulers/batch/delete', {
      ids: [ownId, foreignId],
    });
    expect(res.status).toBe(200);
    expect((res.body as { deletedCount: number }).deletedCount).toBe(1);

    const ownRows = await getDb(app).select().from(scheduler).where(eq(scheduler.id, ownId));
    expect(ownRows).toHaveLength(0);
    const foreignRows = await getDb(app)
      .select()
      .from(scheduler)
      .where(eq(scheduler.id, foreignId));
    expect(foreignRows).toHaveLength(1);

    const [survivor] = await getDb(app)
      .select()
      .from(operation)
      .where(eq(operation.id, generated.id));
    expect(survivor.schedulerId).toBeNull();

    const [event] = await getDb(app)
      .select()
      .from(securityEvent)
      .where(
        and(
          eq(securityEvent.eventType, 'scheduler_batch_deleted'),
          eq(securityEvent.memberId, memberId),
        ),
      )
      .orderBy(desc(securityEvent.createdAt))
      .limit(1);
    expect(event).toBeDefined();
  });

  it('drops ids on a closed account rather than deleting them', async () => {
    const { mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountId = await createAccount(mutate, bankId);
    const id = await createScheduler(mutate, accountId);
    await mutate('post', `/accounts/${accountId}/close`);

    const res = await mutate('post', '/schedulers/batch/delete', {
      ids: [id],
    });
    expect((res.body as { deletedCount: number }).deletedCount).toBe(0);

    const rows = await getDb(app).select().from(scheduler).where(eq(scheduler.id, id));
    expect(rows).toHaveLength(1);
  });
});

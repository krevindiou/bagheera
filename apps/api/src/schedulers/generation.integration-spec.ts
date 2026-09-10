import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { toMinorUnits } from '../common/money';
import { operation, scheduler } from '../db/schema';
import { PAYMENT_METHOD_ID } from '../db/seed-data';
import {
  csrfTokenFor,
  insertActiveMember,
  seedSignedInMember,
  SignedInFixture,
} from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';
import { insertAccount, insertBank } from '../test-support/db-fixtures';

async function createBank(mutate: SignedInFixture['mutate']): Promise<string> {
  const res = await mutate('post', '/banks/choice', { name: 'Test bank' });
  return (res.body as { id: string }).id;
}

async function createAccount(
  mutate: SignedInFixture['mutate'],
  bankId: string,
): Promise<string> {
  const res = await mutate('post', '/accounts', {
    bankId,
    name: 'Account',
    currency: 'EUR',
  });
  return (res.body as { account: { id: string } }).account.id;
}

describe('scheduler occurrence generation', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

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

    const generated = await getDb(app)
      .select()
      .from(operation)
      .where(eq(operation.schedulerId, id));
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

    const afterResave = await getDb(app)
      .select()
      .from(operation)
      .where(eq(operation.schedulerId, id));
    expect(afterResave).toHaveLength(generated.length);
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

    const generated = await getDb(app)
      .select()
      .from(operation)
      .where(eq(operation.schedulerId, id));
    expect(generated).toHaveLength(0);
  });

  it('generates a backlog as a side effect of signing in, not just of saving the scheduler', async () => {
    // Inserted directly via Drizzle — bypassing POST /schedulers entirely —
    // so create()'s own immediate generateForScheduler() call never runs;
    // the only thing that can generate this backlog is sign-in's catch-up.
    const db = getDb(app);
    const { email, password, memberId } = await insertActiveMember(app);
    const bank = await insertBank(db, memberId);
    const account = await insertAccount(db, bank.id);
    await db.insert(scheduler).values({
      accountId: account.id,
      thirdParty: 'Direct-insert rent',
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      debit: toMinorUnits(50),
      valueDate: '2024-01-01',
      frequencyValue: 1,
      frequencyUnit: 'month',
      active: true,
    });

    const agent = request.agent(app.getHttpServer());
    const csrfToken = await csrfTokenFor(agent);
    await agent
      .post('/auth/sign-in')
      .set('x-csrf-token', csrfToken)
      .send({ email, password })
      .expect(200);

    const generated = await getDb(app)
      .select()
      .from(operation)
      .where(eq(operation.accountId, account.id));
    expect(generated.length).toBeGreaterThan(0);
  });
});

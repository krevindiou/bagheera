import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { eq } from 'drizzle-orm';
import { toMinorUnits } from '../common/money';
import { account, bank, report, scheduler } from '../db/schema';
import { PAYMENT_METHOD_ID } from '../db/seed-data';
import { seedSignedInMember } from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';
import { insertAccount, insertBank } from '../test-support/db-fixtures';
import { MEMBER_QUOTAS } from './member-quotas';

function messageOf(res: { body: unknown }): string {
  return (res.body as { message: string }).message;
}

function times<T>(count: number, row: (i: number) => T): T[] {
  return Array.from({ length: count }, (_, i) => row(i));
}

// M5: nothing capped how many banks, accounts, schedulers or reports one
// member could pile up. Filled straight in the database up to each cap —
// through the API, the write budget would run out first.
describe('member quotas', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuses a bank past the quota, until deleting one frees a slot', async () => {
    const { memberId, mutate } = await seedSignedInMember(app);
    const db = getDb(app);
    await db
      .insert(bank)
      .values(times(MEMBER_QUOTAS.banks, (i) => ({ memberId, name: `Bank ${i}` })));

    const refused = await mutate('post', '/banks/choice', { name: 'One too many' });
    expect(refused.status).toBe(422);
    expect(messageOf(refused)).toBe(`You can have at most ${MEMBER_QUOTAS.banks} banks.`);

    const [first] = await db.select({ id: bank.id }).from(bank).where(eq(bank.memberId, memberId));
    await db.update(bank).set({ deleted: true }).where(eq(bank.id, first.id));
    expect((await mutate('post', '/banks/choice', { name: 'Now fine' })).status).toBe(200);
  });

  it('refuses an account past the quota', async () => {
    const { memberId, mutate } = await seedSignedInMember(app);
    const db = getDb(app);
    const bankRow = await insertBank(db, memberId);
    await db.insert(account).values(
      times(MEMBER_QUOTAS.accounts, (i) => ({
        bankId: bankRow.id,
        name: `Account ${i}`,
        currency: 'EUR',
      })),
    );

    const res = await mutate('post', '/accounts', {
      bankId: bankRow.id,
      name: 'One too many',
      currency: 'EUR',
    });
    expect(res.status).toBe(422);
  });

  it('refuses a scheduler past the quota', async () => {
    const { memberId, mutate } = await seedSignedInMember(app);
    const db = getDb(app);
    const accountRow = await insertAccount(db, (await insertBank(db, memberId)).id);
    await db.insert(scheduler).values(
      times(MEMBER_QUOTAS.schedulers, () => ({
        accountId: accountRow.id,
        thirdParty: 'Rent',
        debit: toMinorUnits(50),
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        valueDate: '2099-01-01',
        frequencyValue: 1,
      })),
    );

    const res = await mutate('post', '/schedulers', {
      accountId: accountRow.id,
      type: 'debit',
      thirdParty: 'One too many',
      amount: 50,
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      valueDate: '2099-01-01',
      frequencyValue: 1,
      frequencyUnit: 'month',
    });
    expect(res.status).toBe(422);
  });

  it('refuses a report past the quota', async () => {
    const { memberId, mutate } = await seedSignedInMember(app);
    await getDb(app)
      .insert(report)
      .values(
        times(MEMBER_QUOTAS.reports, (i) => ({
          memberId,
          type: 'sum' as const,
          title: `Report ${i}`,
          periodGrouping: 'month' as const,
        })),
      );

    const res = await mutate('post', '/reports', {
      type: 'sum',
      title: 'One too many',
      periodGrouping: 'month',
    });
    expect(res.status).toBe(422);
  });

  it("doesn't count another member's rows", async () => {
    const full = await seedSignedInMember(app);
    await getDb(app)
      .insert(bank)
      .values(times(MEMBER_QUOTAS.banks, (i) => ({ memberId: full.memberId, name: `Bank ${i}` })));

    const other = await seedSignedInMember(app);
    expect((await other.mutate('post', '/banks/choice', { name: 'Mine' })).status).toBe(200);
  });
});

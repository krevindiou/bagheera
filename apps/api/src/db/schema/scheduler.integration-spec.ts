import { sql } from 'drizzle-orm';
import { MinorUnits } from '../../common/money';
import { PAYMENT_METHOD_ID } from '../seed-data';
import {
  connectIntegrationDb,
  IntegrationDb,
} from '../test-utils/integration-db';
import { account } from './account';
import { bank } from './bank';
import { member } from './member';
import { operation } from './operation';
import { paymentMethod } from './payment-method';
import { scheduler } from './scheduler';

// Test fixtures write already-minor-units literals straight into insert
// calls; brand them so they satisfy debit/credit's MinorUnits type.
const asMinorUnits = (value: number) => value as MinorUnits;

describe('scheduler schema', () => {
  let ctx: IntegrationDb;
  let accountId: string;

  beforeAll(async () => {
    ctx = connectIntegrationDb();
    await ctx.db
      .insert(paymentMethod)
      .values({
        id: PAYMENT_METHOD_ID.CREDIT_CARD,
        name: 'Credit card',
        type: 'debit',
      })
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    await ctx.db.execute(
      sql`truncate table ${operation}, ${scheduler}, ${account}, ${bank}, ${member} restart identity cascade`,
    );
    const [memberRow] = await ctx.db
      .insert(member)
      .values({ email: 'owner@example.com', password: 'hash', country: 'FR' })
      .returning({ id: member.id });
    const [bankRow] = await ctx.db
      .insert(bank)
      .values({ memberId: memberRow.id, name: 'Some Bank' })
      .returning({ id: bank.id });
    const [accountRow] = await ctx.db
      .insert(account)
      .values({ bankId: bankRow.id, name: 'Checking', currency: 'EUR' })
      .returning({ id: account.id });
    accountId = accountRow.id;
  });

  afterAll(async () => {
    await ctx.pool.end();
  });

  const base = () => ({
    accountId,
    paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
    thirdParty: 'Rent',
    valueDate: '2026-01-01',
    frequencyValue: 1,
  });

  it('rejects a row with both debit and credit set', async () => {
    await expect(
      ctx.db.insert(scheduler).values({
        ...base(),
        debit: asMinorUnits(1000),
        credit: asMinorUnits(1000),
      }),
    ).rejects.toMatchObject({ cause: { code: '23514' } }); // check_violation
  });

  it('rejects a row with neither debit nor credit set', async () => {
    await expect(
      ctx.db.insert(scheduler).values({ ...base() }),
    ).rejects.toMatchObject({ cause: { code: '23514' } });
  });

  it('inserts a scheduler and an operation linked via scheduler_id', async () => {
    const [schedulerRow] = await ctx.db
      .insert(scheduler)
      .values({ ...base(), debit: asMinorUnits(5000) })
      .returning();
    expect(schedulerRow).toMatchObject({
      active: true,
      frequencyUnit: 'month',
    });

    const [operationRow] = await ctx.db
      .insert(operation)
      .values({
        accountId,
        schedulerId: schedulerRow.id,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        thirdParty: 'Rent',
        debit: asMinorUnits(5000),
      })
      .returning();

    expect(operationRow.schedulerId).toBe(schedulerRow.id);
  });
});

import { sql } from 'drizzle-orm';
import {
  connectIntegrationDb,
  IntegrationDb,
} from '../test-utils/integration-db';
import { account } from './account';
import { bank } from './bank';
import { member } from './member';
import { operation } from './operation';
import { paymentMethod } from './payment-method';

describe('operation schema', () => {
  let ctx: IntegrationDb;
  let accountId: number;

  beforeAll(async () => {
    ctx = connectIntegrationDb();
    // Not dependent on `pnpm db:seed` having run — insert the one payment
    // method row these tests need.
    await ctx.db
      .insert(paymentMethod)
      .values({ id: 1, name: 'Credit card', type: 'debit' })
      .onConflictDoNothing();
  });

  beforeEach(async () => {
    await ctx.db.execute(
      sql`truncate table ${operation}, ${account}, ${bank}, ${member} restart identity cascade`,
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
    paymentMethodId: 1,
    thirdParty: 'Some Third Party',
  });

  it('rejects a row with both debit and credit set', async () => {
    await expect(
      ctx.db.insert(operation).values({ ...base(), debit: 1000, credit: 1000 }),
    ).rejects.toMatchObject({ cause: { code: '23514' } }); // check_violation
  });

  it('rejects a row with neither debit nor credit set', async () => {
    await expect(
      ctx.db.insert(operation).values({ ...base() }),
    ).rejects.toMatchObject({ cause: { code: '23514' } });
  });

  it('rejects an operation with no matching account', async () => {
    await expect(
      ctx.db
        .insert(operation)
        .values({ ...base(), accountId: 9999, credit: 1000 }),
    ).rejects.toMatchObject({ cause: { code: '23503' } }); // foreign_key_violation
  });

  it('accepts a valid debit-only row and a valid credit-only row', async () => {
    const [debitRow] = await ctx.db
      .insert(operation)
      .values({ ...base(), debit: 1000 })
      .returning();
    expect(debitRow).toMatchObject({ debit: 1000, credit: null });

    const [creditRow] = await ctx.db
      .insert(operation)
      .values({ ...base(), credit: 2000 })
      .returning();
    expect(creditRow).toMatchObject({ debit: null, credit: 2000 });
  });

  it('enforces uniqueness of transfer_operation_id', async () => {
    const [first] = await ctx.db
      .insert(operation)
      .values({ ...base(), credit: 1000 })
      .returning({ id: operation.id });
    const [second] = await ctx.db
      .insert(operation)
      .values({ ...base(), debit: 1000 })
      .returning({ id: operation.id });

    await ctx.db
      .update(operation)
      .set({ transferOperationId: second.id })
      .where(sql`${operation.id} = ${first.id}`);

    const [third] = await ctx.db
      .insert(operation)
      .values({ ...base(), debit: 1000 })
      .returning({ id: operation.id });

    await expect(
      ctx.db
        .update(operation)
        .set({ transferOperationId: second.id })
        .where(sql`${operation.id} = ${third.id}`),
    ).rejects.toMatchObject({ cause: { code: '23505' } }); // unique_violation
  });
});

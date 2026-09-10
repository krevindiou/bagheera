import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { toMinorUnits } from '../../common/money';
import { createTestApp, getDb } from '../../test-support/create-test-app';
import {
  ANY_PAYMENT_METHOD_ID,
  insertMemberBankAccount,
} from '../../test-support/db-fixtures';
import * as schema from './index';
import { operation } from './operation';

type Db = NodePgDatabase<typeof schema>;

// Arbitrary — these specs only care that debit/credit holds *some* valid
// MinorUnits value, never about the actual amount.
const AMOUNT = toMinorUnits(10);
const OTHER_AMOUNT = toMinorUnits(5);

function insertOperation(
  db: Db,
  accountId: string,
  overrides: Partial<typeof operation.$inferInsert> = {},
) {
  return db
    .insert(operation)
    .values({
      accountId,
      paymentMethodId: ANY_PAYMENT_METHOD_ID,
      thirdParty: 'Test third party',
      debit: AMOUNT,
      ...overrides,
    })
    .returning();
}

describe('operation schema', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('debit/credit exclusivity CHECK', () => {
    it('rejects a row with both debit and credit set', async () => {
      const { account } = await insertMemberBankAccount(getDb(app));

      await expect(
        insertOperation(getDb(app), account.id, {
          debit: AMOUNT,
          credit: OTHER_AMOUNT,
        }),
      ).rejects.toMatchObject({ cause: { code: '23514' } });
    });

    it('rejects a row with neither debit nor credit set', async () => {
      const { account } = await insertMemberBankAccount(getDb(app));

      await expect(
        insertOperation(getDb(app), account.id, {
          debit: null,
          credit: null,
        }),
      ).rejects.toMatchObject({ cause: { code: '23514' } });
    });

    it('accepts a debit-only row', async () => {
      const { account } = await insertMemberBankAccount(getDb(app));

      const [row] = await insertOperation(getDb(app), account.id, {
        debit: AMOUNT,
        credit: null,
      });
      expect(row.debit).toBe(AMOUNT);
      expect(row.credit).toBeNull();
    });

    it('accepts a credit-only row', async () => {
      const { account } = await insertMemberBankAccount(getDb(app));

      const [row] = await insertOperation(getDb(app), account.id, {
        debit: null,
        credit: OTHER_AMOUNT,
      });
      expect(row.credit).toBe(OTHER_AMOUNT);
      expect(row.debit).toBeNull();
    });
  });

  describe('required FKs', () => {
    it('rejects an operation pointing at an account that does not exist', async () => {
      await expect(
        insertOperation(getDb(app), randomUUID()),
      ).rejects.toMatchObject({ cause: { code: '23503' } });
    });

    it('rejects an operation pointing at a payment method that does not exist', async () => {
      const { account } = await insertMemberBankAccount(getDb(app));

      await expect(
        insertOperation(getDb(app), account.id, {
          paymentMethodId: randomUUID(),
        }),
      ).rejects.toMatchObject({ cause: { code: '23503' } });
    });
  });

  describe('transferOperationId (self-FK, unique)', () => {
    it('rejects a transferOperationId pointing at an operation that does not exist', async () => {
      const { account } = await insertMemberBankAccount(getDb(app));

      await expect(
        insertOperation(getDb(app), account.id, {
          transferOperationId: randomUUID(),
        }),
      ).rejects.toMatchObject({ cause: { code: '23503' } });
    });

    it('allows one operation to point back at a real counterpart', async () => {
      const { account } = await insertMemberBankAccount(getDb(app));
      const [counterpart] = await insertOperation(getDb(app), account.id, {
        credit: AMOUNT,
        debit: null,
      });

      const [row] = await insertOperation(getDb(app), account.id, {
        debit: AMOUNT,
        transferOperationId: counterpart.id,
      });
      expect(row.transferOperationId).toBe(counterpart.id);
    });

    it('rejects a second operation pointing at the same counterpart', async () => {
      const { account } = await insertMemberBankAccount(getDb(app));
      const [counterpart] = await insertOperation(getDb(app), account.id, {
        credit: AMOUNT,
        debit: null,
      });
      await insertOperation(getDb(app), account.id, {
        debit: AMOUNT,
        transferOperationId: counterpart.id,
      });

      await expect(
        insertOperation(getDb(app), account.id, {
          debit: AMOUNT,
          transferOperationId: counterpart.id,
        }),
      ).rejects.toMatchObject({ cause: { code: '23505' } });
    });
  });
});

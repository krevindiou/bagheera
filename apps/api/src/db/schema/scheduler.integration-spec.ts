import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { toMinorUnits } from '../../common/money';
import { createTestApp, getDb } from '../../test-support/create-test-app';
import {
  ANY_PAYMENT_METHOD_ID,
  insertMemberBankAccount,
} from '../../test-support/db-fixtures';
import * as schema from './index';
import { scheduler } from './scheduler';

type Db = NodePgDatabase<typeof schema>;

// Arbitrary — these specs only care that debit/credit holds *some* valid
// MinorUnits value, never about the actual amount.
const AMOUNT = toMinorUnits(10);
const OTHER_AMOUNT = toMinorUnits(5);

function insertScheduler(
  db: Db,
  accountId: string,
  overrides: Partial<typeof scheduler.$inferInsert> = {},
) {
  return db
    .insert(scheduler)
    .values({
      accountId,
      paymentMethodId: ANY_PAYMENT_METHOD_ID,
      thirdParty: 'Test third party',
      valueDate: '2026-01-01',
      frequencyValue: 1,
      debit: AMOUNT,
      ...overrides,
    })
    .returning();
}

describe('scheduler schema', () => {
  let app: INestApplication<Server>;

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
        insertScheduler(getDb(app), account.id, {
          debit: AMOUNT,
          credit: OTHER_AMOUNT,
        }),
      ).rejects.toMatchObject({ cause: { code: '23514' } });
    });

    it('rejects a row with neither debit nor credit set', async () => {
      const { account } = await insertMemberBankAccount(getDb(app));

      await expect(
        insertScheduler(getDb(app), account.id, {
          debit: null,
          credit: null,
        }),
      ).rejects.toMatchObject({ cause: { code: '23514' } });
    });

    it('accepts a credit-only row', async () => {
      const { account } = await insertMemberBankAccount(getDb(app));

      const [row] = await insertScheduler(getDb(app), account.id, {
        debit: null,
        credit: OTHER_AMOUNT,
      });
      expect(row.credit).toBe(OTHER_AMOUNT);
      expect(row.debit).toBeNull();
    });
  });

  describe('required FKs', () => {
    it('rejects a scheduler pointing at an account that does not exist', async () => {
      await expect(
        insertScheduler(getDb(app), randomUUID()),
      ).rejects.toMatchObject({ cause: { code: '23503' } });
    });

    it('rejects a scheduler pointing at a payment method that does not exist', async () => {
      const { account } = await insertMemberBankAccount(getDb(app));

      await expect(
        insertScheduler(getDb(app), account.id, {
          paymentMethodId: randomUUID(),
        }),
      ).rejects.toMatchObject({ cause: { code: '23503' } });
    });
  });

  describe('frequencyValue (smallint)', () => {
    it('accepts the smallint upper bound', async () => {
      const { account } = await insertMemberBankAccount(getDb(app));

      const [row] = await insertScheduler(getDb(app), account.id, {
        frequencyValue: 32767,
      });
      expect(row.frequencyValue).toBe(32767);
    });

    // The real DB-level ceiling behind schedulers/generation/interval.ts's
    // application-level cap (see 726f0aed) — that fix stops a too-large
    // frequencyValue from ever reaching this column; this proves the
    // column itself would refuse one anyway if something bypassed the cap.
    it('rejects a value beyond the smallint range', async () => {
      const { account } = await insertMemberBankAccount(getDb(app));

      await expect(
        insertScheduler(getDb(app), account.id, { frequencyValue: 32768 }),
      ).rejects.toMatchObject({ cause: { code: '22003' } });
    });
  });
});

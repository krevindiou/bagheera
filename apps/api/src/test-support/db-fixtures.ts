import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { account, bank, member } from '../db/schema';
import * as schema from '../db/schema';
import { PAYMENT_METHOD_ID } from '../db/seed-data';
import { uniqueEmail } from './auth-fixture';

// Direct-insert helpers for specs that drive Drizzle rather than HTTP.

type Db = NodePgDatabase<typeof schema>;

// A valid FK target wherever a test only needs *a* real payment method, not
// one tied to a debit/credit direction — INITIAL_BALANCE has no fixed
// pairing (type: null in seed-data.ts).
export const ANY_PAYMENT_METHOD_ID = PAYMENT_METHOD_ID.INITIAL_BALANCE;

export async function insertMember(db: Db, overrides: Partial<typeof member.$inferInsert> = {}) {
  const [row] = await db
    .insert(member)
    .values({
      email: uniqueEmail(),
      country: 'FR',
      ...overrides,
    })
    .returning();
  return row;
}

export async function insertBank(
  db: Db,
  memberId: string,
  overrides: Partial<typeof bank.$inferInsert> = {},
) {
  const [row] = await db
    .insert(bank)
    .values({ memberId, name: 'Test bank', ...overrides })
    .returning();
  return row;
}

export async function insertAccount(
  db: Db,
  bankId: string,
  overrides: Partial<typeof account.$inferInsert> = {},
) {
  const [row] = await db
    .insert(account)
    .values({ bankId, name: 'Test account', currency: 'EUR', ...overrides })
    .returning();
  return row;
}

/** Builds a full member → bank → account chain in one call, for specs that just need a valid accountId to hang their own table's row off. */
export async function insertMemberBankAccount(db: Db) {
  const memberRow = await insertMember(db);
  const bankRow = await insertBank(db, memberRow.id);
  const accountRow = await insertAccount(db, bankRow.id);
  return { member: memberRow, bank: bankRow, account: accountRow };
}

import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { account, bank, member } from '../db/schema';
import * as schema from '../db/schema';
import { PAYMENT_METHOD_ID, SALARY_CATEGORY_SEED_ID } from '../db/seed-data';
import { uniqueEmail } from './auth-fixture';

// Tier 1 (db/schema/*.integration-spec.ts) drives Drizzle directly instead
// of going through HTTP — these are plain insert helpers for building the
// member → bank → account chain those specs need before exercising their
// own table's constraints, plus the pg error-code accessor every one of
// them uses to assert *which* constraint fired.

type Db = NodePgDatabase<typeof schema>;

/** Same access pattern `race-safe-unique-email.ts` uses in production. */
export function pgErrorCode(err: unknown): string | undefined {
  return (err as { cause?: { code?: string } }).cause?.code;
}

// A valid FK target wherever a test only needs *a* real payment method, not
// one tied to a debit/credit direction — INITIAL_BALANCE has no fixed
// pairing (type: null in seed-data.ts).
export const ANY_PAYMENT_METHOD_ID = PAYMENT_METHOD_ID.INITIAL_BALANCE;
// The one category id stable across reseeds (see seed-data.ts) — every
// other category gets a DB-generated id.
export const ANY_CATEGORY_ID = SALARY_CATEGORY_SEED_ID;

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

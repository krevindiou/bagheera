import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { entryTypeEnum } from './enums';

// Fixed reference list — ids are stable identifiers relied on by business
// logic, not auto-generated. UUIDs are hardcoded literals (see seed-data.ts),
// not DB-generated defaults.
export const paymentMethod = pgTable('payment_method', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 16 }).notNull(),
  // Null only for "Initial balance" (PAYMENT_METHOD_ID.INITIAL_BALANCE in
  // seed-data.ts), reserved for the system-generated opening operation.
  type: entryTypeEnum('type'),
});

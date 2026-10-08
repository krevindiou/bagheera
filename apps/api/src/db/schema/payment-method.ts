import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { entryTypeEnum } from './enums';

// Fixed reference list: ids are hardcoded literals business logic relies
// on (see packages/reference-data), not DB-generated.
export const paymentMethod = pgTable('payment_method', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 16 }).notNull(),
  // Null only for "Initial balance" (PAYMENT_METHOD_ID.INITIAL_BALANCE in
  // seed-data.ts), reserved for the system-generated opening operation.
  type: entryTypeEnum('type'),
});

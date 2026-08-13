import { integer, pgTable, varchar } from 'drizzle-orm/pg-core';
import { entryTypeEnum } from './enums';

// Fixed reference list — ids are stable identifiers relied on by business
// logic, not auto-generated.
export const paymentMethod = pgTable('payment_method', {
  id: integer('id').primaryKey(),
  name: varchar('name', { length: 16 }).notNull(),
  // Null only for "Initial balance" (id 9), reserved for the system-generated
  // opening operation.
  type: entryTypeEnum('type'),
});

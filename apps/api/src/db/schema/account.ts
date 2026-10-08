import { boolean, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { bank } from './bank';
import { uuidPk } from './id';

// Bank and currency are immutable after creation (enforced by
// AccountService, not the schema).
export const account = pgTable(
  'account',
  {
    id: uuidPk(),
    bankId: uuid('bank_id')
      .notNull()
      .references(() => bank.id),
    name: varchar('name', { length: 64 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    closed: boolean('closed').notNull().default(false),
    deleted: boolean('deleted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('account_bank_id_idx').on(table.bankId)],
);

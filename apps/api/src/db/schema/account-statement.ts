import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { account } from './account';

// What a bank file named of its account at the first import into one: a
// fingerprint, never the identifier. A table of its own keeps
// it out of every account response.
export const accountStatement = pgTable(
  'account_statement',
  {
    accountId: uuid('account_id')
      .primaryKey()
      .references(() => account.id),
    fingerprint: varchar('fingerprint', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('account_statement_fingerprint_idx').on(table.fingerprint)],
);

import { boolean, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { FIELD_LIMITS } from '@bagheera/reference-data';
import { uuidPk } from './id';
import { member } from './member';

export const bank = pgTable(
  'bank',
  {
    id: uuidPk(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => member.id),
    name: varchar('name', { length: FIELD_LIMITS.BANK_NAME }).notNull(),
    closed: boolean('closed').notNull().default(false),
    deleted: boolean('deleted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('bank_member_id_idx').on(table.memberId)],
);

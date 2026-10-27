import { sql } from 'drizzle-orm';
import { pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { FIELD_LIMITS } from '@bagheera/reference-data';
import { uuidPk } from './id';
import { member } from './member';

// A Member's remembered replacement of a bank-file label by the third party
// they would type.
export const labelCorrection = pgTable(
  'label_correction',
  {
    id: uuidPk(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => member.id),
    sourceLabel: varchar('source_label', { length: FIELD_LIMITS.SOURCE_LABEL }).notNull(),
    thirdParty: varchar('third_party', { length: FIELD_LIMITS.THIRD_PARTY }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // One correction per source label, ignoring case; the member id leads, so
    // it also serves the listing of a member's corrections.
    uniqueIndex('label_correction_member_id_source_label_unique').on(
      table.memberId,
      sql`lower(${table.sourceLabel})`,
    ),
  ],
);

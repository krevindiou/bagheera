import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { uuidPk } from './id';
import { member } from './member';
import { securityEventTypeEnum } from './enums';

// Addition beyond the core entity catalog, required for audit-log
// requirements. memberId is nullable: some events (e.g. a failed sign-in
// against an unknown email) have no resolvable member.
export const securityEvent = pgTable(
  'security_event',
  {
    id: uuidPk(),
    memberId: uuid('member_id').references(() => member.id),
    eventType: securityEventTypeEnum('event_type').notNull(),
    sourceAddress: varchar('source_address', { length: 45 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('security_event_member_id_created_at_idx').on(table.memberId, table.createdAt)],
);

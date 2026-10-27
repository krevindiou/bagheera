import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { uuidPk } from './id';
import { member } from './member';
import { securityEventTypeEnum } from './enums';

// Audit log. memberId is nullable: some events (e.g. a failed sign-in with
// an unknown passkey) have no resolvable member.
export const securityEvent = pgTable(
  'security_event',
  {
    id: uuidPk(),
    memberId: uuid('member_id').references(() => member.id),
    eventType: securityEventTypeEnum('event_type').notNull(),
    sourceAddress: varchar('source_address', { length: 45 }).notNull(),
    // What an event adds to who, what and where, for the few that have more to say.
    details: jsonb('details').$type<Record<string, string | number>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('security_event_member_id_created_at_idx').on(table.memberId, table.createdAt)],
);

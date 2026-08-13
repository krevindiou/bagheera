import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

// Password column is sized for an Argon2id PHC-format hash rather than a
// legacy bcrypt-length hash.
export const member = pgTable(
  'member',
  {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 128 }).notNull(),
    password: varchar('password', { length: 255 }).notNull(),
    country: varchar('country', { length: 2 }).notNull(),
    active: boolean('active').notNull().default(false),
    loggedAt: timestamp('logged_at', { withTimezone: true }),
    // Bumped to invalidate all outstanding tokens of the given kind —
    // activation/password-reset tokens are versioned, not stored rows.
    activationTokenVersion: integer('activation_token_version')
      .notNull()
      .default(0),
    passwordResetTokenVersion: integer('password_reset_token_version')
      .notNull()
      .default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('member_email_unique').on(sql`lower(${table.email})`),
  ],
);

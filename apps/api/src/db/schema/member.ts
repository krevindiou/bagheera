import { sql } from 'drizzle-orm';
import { integer, pgTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { TIME_ZONE_MAX_LENGTH } from '../../common/local-date';
import { DEFAULT_LOCALE } from '../../common/locale';
import { localeEnum } from './enums';
import { uuidPk } from './id';

// No password and no "not yet activated" state: a member row is only
// inserted once its first passkey exists (see WebauthnSignupService).
export const member = pgTable(
  'member',
  {
    id: uuidPk(),
    email: varchar('email', { length: 128 }).notNull(),
    country: varchar('country', { length: 2 }).notNull(),
    // UI/email language, independent of `country`. Set at registration from
    // the browser's locale, changeable from settings.
    locale: localeEnum('locale').notNull().default(DEFAULT_LOCALE),
    // IANA zone deciding the member's "today" (see member-today.ts). Set at
    // registration from the browser's zone, changeable from settings. Null
    // for members who predate it or whose browser sent none: they follow
    // APP_TIMEZONE.
    timeZone: varchar('time_zone', { length: TIME_ZONE_MAX_LENGTH }),
    loggedAt: timestamp('logged_at', { withTimezone: true }),
    // Set while an email change is awaiting confirmation at the new
    // address; null the rest of the time. `email` itself is only ever
    // written once that confirmation lands — see ProfileService.
    pendingEmail: varchar('pending_email', { length: 128 }),
    emailChangeTokenVersion: integer('email_change_token_version').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex('member_email_unique').on(sql`lower(${table.email})`)],
);

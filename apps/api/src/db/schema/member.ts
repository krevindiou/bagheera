import { sql } from 'drizzle-orm';
import { integer, pgTable, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { DEFAULT_LOCALE } from '../../common/locale';
import { localeEnum } from './enums';
import { uuidPk } from './id';

// Authentication is WebAuthn-only — see webauthn_credential. There is no
// password on this table and no "not yet activated" state: a member row is
// only ever inserted once a passkey has been created for it (see
// WebauthnSignupService), so a row existing is itself the activation signal.
export const member = pgTable(
  'member',
  {
    id: uuidPk(),
    email: varchar('email', { length: 128 }).notNull(),
    country: varchar('country', { length: 2 }).notNull(),
    // UI/email language — independent of `country` (which only ever
    // guesses a currency, see useCurrencyOptions.ts). Set at registration
    // from whatever locale was active in the browser then, changeable
    // afterwards from settings (see ProfileController's `locale` route).
    locale: localeEnum('locale').notNull().default(DEFAULT_LOCALE),
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

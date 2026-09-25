import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { uuidPk } from './id';
import { member } from './member';

// One row per registered passkey. A member can hold several (one per
// device); passkeys are the only sign-in method — see webauthn/ module docs.
export const webauthnCredential = pgTable(
  'webauthn_credential',
  {
    id: uuidPk(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    // Base64url authenticator-issued credential id — opaque, looked up on
    // every authentication ceremony.
    credentialId: text('credential_id').notNull(),
    // Base64-encoded COSE public key bytes (WebAuthnCredential.publicKey).
    publicKey: text('public_key').notNull(),
    // Signature counter reported by the authenticator; bumped on every
    // successful authentication to detect cloned credentials.
    counter: bigint('counter', { mode: 'number' }).notNull().default(0),
    transports: jsonb('transports').$type<string[]>(),
    // User-supplied label (e.g. "MacBook Touch ID"), shown in the settings list.
    deviceName: varchar('device_name', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('webauthn_credential_credential_id_unique').on(table.credentialId),
    index('webauthn_credential_member_id_idx').on(table.memberId),
  ],
);

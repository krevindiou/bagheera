import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  integer,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { account } from './account';
import { category } from './category';
import { frequencyUnitEnum } from './enums';
import { paymentMethod } from './payment-method';

// Same operation-like fields (value date = first occurrence) plus recurrence
// config. Mirrors Operation's debit/credit exclusivity CHECK.
export const scheduler = pgTable(
  'scheduler',
  {
    id: serial('id').primaryKey(),
    accountId: integer('account_id')
      .notNull()
      .references(() => account.id),
    transferAccountId: integer('transfer_account_id').references(
      () => account.id,
    ),
    categoryId: integer('category_id').references(() => category.id),
    paymentMethodId: integer('payment_method_id')
      .notNull()
      .references(() => paymentMethod.id),
    thirdParty: varchar('third_party', { length: 64 }).notNull(),
    debit: bigint('debit', { mode: 'number' }),
    credit: bigint('credit', { mode: 'number' }),
    valueDate: date('value_date').notNull(),
    reconciled: boolean('reconciled').notNull().default(false),
    notes: text('notes').notNull().default(''),
    limitDate: date('limit_date'),
    frequencyUnit: frequencyUnitEnum('frequency_unit')
      .notNull()
      .default('month'),
    frequencyValue: smallint('frequency_value').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      'scheduler_debit_credit_exclusive',
      sql`(${table.debit} is null) <> (${table.credit} is null)`,
    ),
  ],
);

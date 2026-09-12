import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { MinorUnits } from '../../common/money';
import { account } from './account';
import { category } from './category';
import { frequencyUnitEnum } from './enums';
import { uuidPk } from './id';
import { paymentMethod } from './payment-method';

// Same operation-like fields (value date = first occurrence) plus recurrence
// config. Mirrors Operation's debit/credit exclusivity CHECK.
export const scheduler = pgTable(
  'scheduler',
  {
    id: uuidPk(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => account.id),
    transferAccountId: uuid('transfer_account_id').references(() => account.id),
    categoryId: uuid('category_id').references(() => category.id),
    paymentMethodId: uuid('payment_method_id')
      .notNull()
      .references(() => paymentMethod.id),
    thirdParty: varchar('third_party', { length: 64 }).notNull(),
    debit: bigint('debit', { mode: 'number' }).$type<MinorUnits>(),
    credit: bigint('credit', { mode: 'number' }).$type<MinorUnits>(),
    valueDate: date('value_date').notNull(),
    reconciled: boolean('reconciled').notNull().default(false),
    notes: text('notes').notNull().default(''),
    limitDate: date('limit_date'),
    frequencyUnit: frequencyUnitEnum('frequency_unit').notNull().default('month'),
    frequencyValue: smallint('frequency_value').notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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

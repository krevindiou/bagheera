import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { MinorUnits } from '../../common/money';
import { account } from './account';
import { category } from './category';
import { paymentMethod } from './payment-method';
import { scheduler } from './scheduler';

// Money columns are integers scaled by 10,000 (four decimal places).
export const operation = pgTable(
  'operation',
  {
    id: serial('id').primaryKey(),
    accountId: integer('account_id')
      .notNull()
      .references(() => account.id),
    // Set on generated occurrences; added alongside the Scheduler table
    // itself in this same migration.
    schedulerId: integer('scheduler_id').references(() => scheduler.id),
    // Mirror of a transfer pair; nullable + unique so at most one operation
    // points back to any given counterpart.
    transferOperationId: integer('transfer_operation_id').references(
      (): AnyPgColumn => operation.id,
    ),
    transferAccountId: integer('transfer_account_id').references(
      () => account.id,
    ),
    categoryId: integer('category_id').references(() => category.id),
    paymentMethodId: integer('payment_method_id')
      .notNull()
      .references(() => paymentMethod.id),
    thirdParty: varchar('third_party', { length: 64 }).notNull(),
    debit: bigint('debit', { mode: 'number' }).$type<MinorUnits>(),
    credit: bigint('credit', { mode: 'number' }).$type<MinorUnits>(),
    valueDate: date('value_date').notNull().defaultNow(),
    reconciled: boolean('reconciled').notNull().default(false),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('operation_transfer_operation_id_unique').on(
      table.transferOperationId,
    ),
    check(
      'operation_debit_credit_exclusive',
      sql`(${table.debit} is null) <> (${table.credit} is null)`,
    ),
  ],
);

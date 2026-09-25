import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { MinorUnits } from '../../common/money';
import { account } from './account';
import { category } from './category';
import { uuidPk } from './id';
import { paymentMethod } from './payment-method';
import { scheduler } from './scheduler';

// Money columns are integers scaled by 10,000 (four decimal places).
export const operation = pgTable(
  'operation',
  {
    id: uuidPk(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => account.id),
    // Set on generated occurrences; added alongside the Scheduler table
    // itself in this same migration.
    schedulerId: uuid('scheduler_id').references(() => scheduler.id),
    // Mirror of a transfer pair; nullable + unique so at most one operation
    // points back to any given counterpart.
    transferOperationId: uuid('transfer_operation_id').references((): AnyPgColumn => operation.id),
    transferAccountId: uuid('transfer_account_id').references(() => account.id),
    categoryId: uuid('category_id').references(() => category.id),
    paymentMethodId: uuid('payment_method_id')
      .notNull()
      .references(() => paymentMethod.id),
    thirdParty: varchar('third_party', { length: 64 }).notNull(),
    debit: bigint('debit', { mode: 'number' }).$type<MinorUnits>(),
    credit: bigint('credit', { mode: 'number' }).$type<MinorUnits>(),
    valueDate: date('value_date').notNull().defaultNow(),
    reconciled: boolean('reconciled').notNull().default(false),
    notes: text('notes').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('operation_transfer_operation_id_unique').on(table.transferOperationId),
    index('operation_account_id_value_date_idx').on(
      table.accountId,
      table.valueDate.desc(),
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('operation_scheduler_id_value_date_idx')
      .on(table.schedulerId, table.valueDate)
      .where(sql`${table.schedulerId} is not null`),
    index('operation_transfer_account_id_idx')
      .on(table.transferAccountId)
      .where(sql`${table.transferAccountId} is not null`),
    check(
      'operation_debit_credit_exclusive',
      sql`(${table.debit} is null) <> (${table.credit} is null)`,
    ),
  ],
);

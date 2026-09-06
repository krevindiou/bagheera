import {
  boolean,
  date,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { account } from './account';
import { uuidPk } from './id';
import { member } from './member';
import { periodGroupingEnum, reportTypeEnum } from './enums';

// Account selection is a plain many-to-many join table — replaced wholesale
// on save at the app layer.
export const report = pgTable('report', {
  id: uuidPk(),
  memberId: uuid('member_id')
    .notNull()
    .references(() => member.id),
  type: reportTypeEnum('type').notNull(),
  title: varchar('title', { length: 64 }).notNull(),
  homepage: boolean('homepage').notNull().default(false),
  valueDateStart: date('value_date_start'),
  valueDateEnd: date('value_date_end'),
  thirdParties: varchar('third_parties', { length: 255 }),
  reconciledOnly: boolean('reconciled_only'),
  periodGrouping: periodGroupingEnum('period_grouping').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const reportAccount = pgTable(
  'report_account',
  {
    reportId: uuid('report_id')
      .notNull()
      .references(() => report.id),
    accountId: uuid('account_id')
      .notNull()
      .references(() => account.id),
  },
  (table) => [primaryKey({ columns: [table.reportId, table.accountId] })],
);

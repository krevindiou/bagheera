import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { account } from './account';
import { category } from './category';
import { uuidPk } from './id';
import { member } from './member';
import { dataGroupingEnum, periodGroupingEnum, reportTypeEnum } from './enums';

// Account selection is a plain many-to-many join table — replaced wholesale
// on save at the app layer.
export const report = pgTable(
  'report',
  {
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
    // Required for every report type — a 'distribution' report ranks *within*
    // each period (defaulting to 'all', a single whole-range bucket) rather
    // than needing no time axis at all.
    periodGrouping: periodGroupingEnum('period_grouping').notNull(),
    // The next two are set for 'distribution' only.
    dataGrouping: dataGroupingEnum('data_grouping'),
    significantResultsNumber: integer('significant_results_number'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('report_member_id_idx').on(table.memberId)],
);

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

// Category selection is the same kind of join table as reportAccount — empty
// = no filter (every category), replaced wholesale on save. Unlike accounts,
// categories are fixed reference data (not member-owned), so there's no
// ownership chain to fall back through when the selection is empty.
export const reportCategory = pgTable(
  'report_category',
  {
    reportId: uuid('report_id')
      .notNull()
      .references(() => report.id),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => category.id),
  },
  (table) => [primaryKey({ columns: [table.reportId, table.categoryId] })],
);

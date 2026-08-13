import { pgEnum } from 'drizzle-orm/pg-core';

// Shared debit/credit typing used by PaymentMethod, Category, Operation and
// Scheduler.
export const entryTypeEnum = pgEnum('entry_type', ['debit', 'credit']);

// Scheduler recurrence unit.
export const frequencyUnitEnum = pgEnum('frequency_unit', [
  'day',
  'week',
  'month',
  'year',
]);

// Report aggregation kind and chart period grouping.
export const reportTypeEnum = pgEnum('report_type', ['sum', 'average']);
export const periodGroupingEnum = pgEnum('period_grouping', [
  'month',
  'quarter',
  'year',
  'all',
]);

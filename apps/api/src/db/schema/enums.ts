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

// SecurityEvent kinds, wired into auth/member modules later. New values can
// be appended by later migrations as more call sites land.
export const securityEventTypeEnum = pgEnum('security_event_type', [
  'sign_in_success',
  'sign_in_failure',
  'sign_in_throttled',
  'password_recovery_requested',
  'password_recovery_completed',
  'password_changed',
  'email_changed',
  'activation_issued',
  'activation_used',
]);

import { pgEnum } from 'drizzle-orm/pg-core';
import { SUPPORTED_LOCALES } from '../../common/locale';

// Shared debit/credit typing used by PaymentMethod, Category, Operation and
// Scheduler.
export const entryTypeEnum = pgEnum('entry_type', ['debit', 'credit']);

// Member's UI/email language preference. Values mirror common/locale.ts's
// SUPPORTED_LOCALES exactly — that's the tuple to edit when a language is
// added, not this line.
export const localeEnum = pgEnum('locale', SUPPORTED_LOCALES);

// Scheduler recurrence unit.
export const frequencyUnitEnum = pgEnum('frequency_unit', ['day', 'week', 'month', 'year']);

// Report aggregation kind and chart period grouping.
export const reportTypeEnum = pgEnum('report_type', ['sum', 'average', 'distribution']);
export const periodGroupingEnum = pgEnum('period_grouping', ['month', 'quarter', 'year', 'all']);

// Grouping key for a 'distribution' report — which dimension operations are
// ranked by.
export const dataGroupingEnum = pgEnum('data_grouping', [
  'category',
  'third_party',
  'payment_method',
]);

// SecurityEvent kinds, wired into auth/member modules later. New values can
// be appended by later migrations as more call sites land.
// The password/activation-era values below (sign_in_*, password_*,
// activation_*) are dead now that auth is WebAuthn-only — kept because
// Postgres enum values can't be dropped and historical security_event rows
// still reference them.
export const securityEventTypeEnum = pgEnum('security_event_type', [
  'sign_in_success',
  'sign_in_failure',
  'sign_in_throttled',
  'sign_in_inactive',
  'password_recovery_requested',
  'password_recovery_completed',
  'password_changed',
  'email_change_requested',
  'email_changed',
  'activation_issued',
  'activation_used',
  'operation_batch_deleted',
  'operation_batch_reconciled',
  'scheduler_batch_deleted',
  'report_batch_deleted',
  'bank_closed',
  'bank_deleted',
  'account_closed',
  'account_deleted',
  'webauthn_credential_registered',
  'webauthn_credential_removed',
  'webauthn_sign_in_success',
  'webauthn_sign_in_failure',
  'signup_confirmation_issued',
  'passkey_signup_completed',
  'step_up_verified',
]);

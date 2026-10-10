import { pgEnum } from 'drizzle-orm/pg-core';
import { ENTRY_TYPES } from '@bagheera/reference-data';
import { SUPPORTED_LOCALES } from '../../common/locale';

// Shared debit/credit typing used by PaymentMethod, Category, Operation and
// Scheduler.
export const entryTypeEnum = pgEnum('entry_type', ENTRY_TYPES);

// Member's UI/email language; edit SUPPORTED_LOCALES, not this line.
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

// Audit-log event kinds (see AuditService).
export const securityEventTypeEnum = pgEnum('security_event_type', [
  'email_change_requested',
  'email_changed',
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

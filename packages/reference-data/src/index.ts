// Fixed payment-method ids shared by apps/api (db/seed-data.ts) and
// apps/web (domain/referenceData.ts): stable across environments and
// reseeds, and referenced by name.
export const PAYMENT_METHOD_ID = {
  CREDIT_CARD: '00000000-0000-7000-8000-000000000001',
  CHECK_DEBIT: '00000000-0000-7000-8000-000000000002',
  CASH_WITHDRAWAL: '00000000-0000-7000-8000-000000000003',
  TRANSFER_DEBIT: '00000000-0000-7000-8000-000000000004',
  CHECK_CREDIT: '00000000-0000-7000-8000-000000000005',
  TRANSFER_CREDIT: '00000000-0000-7000-8000-000000000006',
  DEPOSIT: '00000000-0000-7000-8000-000000000007',
  DIRECT_DEBIT: '00000000-0000-7000-8000-000000000008',
  INITIAL_BALANCE: '00000000-0000-7000-8000-000000000009',
} as const;

// The only payment methods that can carry a transfer pairing.
export const TRANSFER_PAYMENT_METHOD_IDS: readonly string[] = [
  PAYMENT_METHOD_ID.TRANSFER_DEBIT,
  PAYMENT_METHOD_ID.TRANSFER_CREDIT,
];

// UI/email locales. The API's `locale` pg enum derives from this list, so
// adding one needs a migration, plus web and email catalogs for it.
export const SUPPORTED_LOCALES = ['en', 'fr'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

// Direction of a payment method, category, operation or scheduler. The API's
// `entry_type` pg enum derives from this list.
export const ENTRY_TYPES = ['debit', 'credit'] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

// A scheduler's recurrence unit. The API's `frequency_unit` pg enum derives
// from this list.
export const FREQUENCY_UNITS = ['day', 'week', 'month', 'year'] as const;
export type FrequencyUnit = (typeof FREQUENCY_UNITS)[number];

// A report's aggregation kind, chart period grouping and, for a distribution
// report, the dimension operations are ranked by. The API's `report_type`,
// `period_grouping` and `data_grouping` pg enums derive from these lists.
export const REPORT_TYPES = ['sum', 'average', 'distribution'] as const;
export const PERIOD_GROUPINGS = ['month', 'quarter', 'year', 'all'] as const;
export const DATA_GROUPINGS = ['category', 'third_party', 'payment_method'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];
export type PeriodGrouping = (typeof PERIOD_GROUPINGS)[number];
export type DataGrouping = (typeof DATA_GROUPINGS)[number];

// Most labels a distribution report shows before folding the rest into
// "Other"; the API's CreateReportDto and the web report form both cap at it.
export const MAX_SIGNIFICANT_RESULTS_NUMBER = 50;

// Bank file import: the largest file and the most data rows (header
// excluded) accepted; shared so the web can refuse a file before uploading it.
export const IMPORT_LIMITS = {
  MAX_FILE_BYTES: 5 * 1024 * 1024,
  MAX_ROWS: 5000,
  // Label corrections a Member may remember.
  MAX_LABEL_CORRECTIONS: 1000,
  // The longest label of a file a correction is kept for: its unique index
  // must fit a btree entry, which the column's own width does not guarantee.
  MAX_CORRECTION_LABEL_CHARACTERS: 512,
  // How much of a row's label a preview shows; the full one stays server-side.
  PREVIEW_LABEL_CHARACTERS: 256,
} as const;

// Page size of the paginated lists, shared so the web's placeholder matches.
export const PAGE_SIZE = 20;

// Caps on member-submitted fields, shared by the API's column widths, its
// DTOs and the web forms. Text caps are character counts; changing one
// that sizes a varchar column needs a migration.
export const FIELD_LIMITS = {
  BANK_NAME: 32,
  ACCOUNT_NAME: 64,
  THIRD_PARTY: 64,
  REPORT_TITLE: 64,
  EMAIL: 128,
  // Notes are an unbounded `text` column; this only bounds the request.
  NOTES: 4096,
  // A scheduler's recurrence interval, in its frequency unit.
  FREQUENCY_VALUE: 100,
  // A report's third-party filter; a `varchar` column width.
  REPORT_THIRD_PARTIES: 255,
  // A passkey's device name; a `varchar` column width.
  DEVICE_NAME: 100,
  // The operation search panel's notes filter — request-only, narrower
  // than NOTES (what's actually saved).
  SEARCH_NOTES: 128,
  // The label of the bank file an imported operation or a label correction
  // keeps; a `varchar` column width.
  SOURCE_LABEL: 4096,
  // The identifier a bank gives an imported row; a `varchar` column width.
  BANK_REFERENCE: 255,
  // Categories a report or an operation search can select; above the
  // seeded set's size so "select all" stays possible.
  CATEGORY_SELECTION: 150,
} as const;

// The synthesis chart's window choices (the trailing 12 or 24 months, or the
// full history), sent as the dashboard and account chart's `range` param.
export const SYNTHESIS_CHART_RANGES = ['12', '24', 'all'] as const;
export type SynthesisChartRange = (typeof SYNTHESIS_CHART_RANGES)[number];

// The rule for every date a member submits: plain 'YYYY-MM-DD', a real
// calendar day, inside these bounds. The bounds keep chart period walks
// small (the API's reports/chart/period.ts sizes MAX_PERIODS from them): one
// operation dated 9999-12-31 would otherwise make a million-point chart.
export const MIN_VALUE_DATE = '1900-01-01';
export const MAX_VALUE_DATE = '2100-12-31';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValueDate(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const match = ISO_DATE.exec(value);
  // Zero-padded dates order chronologically as strings.
  if (!match || value < MIN_VALUE_DATE || value > MAX_VALUE_DATE) {
    return false;
  }
  const [year, month, day] = match.slice(1).map(Number);
  // Day 0 of the next month is the last day of `month`; rejects e.g.
  // 2024-02-30, which Postgres would refuse with a 500.
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= lastDayOfMonth;
}

// The calendar day `now` falls on in `timeZone` (the runtime's own zone when
// omitted), as 'YYYY-MM-DD': what "today" means for a member.
export function isoDateIn(timeZone?: string, now: Date = new Date()): string {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

// Every code the API's BusinessError can throw, so the web's locale
// catalogs can be typed to require a translation for each one.
export const BUSINESS_ERROR_CODES = [
  'account_cannot_be_changed',
  'account_not_active',
  'account_not_found',
  'bank_already_deleted',
  'bank_currency_immutable',
  'bank_not_active',
  'bank_required',
  'category_invalid',
  'email_change_link_invalid',
  'import_account_mismatch',
  'import_file_invalid',
  'import_file_too_large',
  'import_in_progress',
  'import_not_found',
  'import_preview_stale',
  'import_statement_currency',
  'import_statement_several',
  'import_statement_unsupported',
  'import_too_many_rows',
  'last_passkey',
  'opening_operation_locked',
  'operation_not_found',
  'passkey_registration_failed',
  'passkey_sign_in_failed',
  'payment_method_invalid',
  'quota_exceeded',
  'signup_link_invalid',
  'step_up_failed',
  'step_up_required',
  'transfer_account_invalid',
  'transfer_account_not_active',
  'transfer_currency_mismatch',
  'transfer_same_account',
] as const;
export type BusinessErrorCode = (typeof BUSINESS_ERROR_CODES)[number];

// ISO 3166-1 alpha-2 codes accepted as a member's country.
// `Intl.supportedValuesOf` has no "region" key, so the list is static.
// prettier-ignore
export const COUNTRY_CODES: readonly string[] = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
  "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE",
  "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF",
  "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
  "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM",
  "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC",
  "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK",
  "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
  "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG",
  "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO",
  "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
  "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW",
];

// ISO 4217 codes accepted as an account currency. `Intl.supportedValuesOf`
// differs between Node and each browser's ICU, so the list is static; the
// web dropdown still takes its labels from `Intl.DisplayNames`.
// prettier-ignore
export const CURRENCY_CODES: readonly string[] = [
  "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN", "BAM", "BBD", "BDT", "BGN", "BHD", "BIF",
  "BMD", "BND", "BOB", "BRL", "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNY", "COP", "CRC",
  "CUC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP", "ERN", "ETB", "EUR", "FJD", "FKP", "GBP", "GEL",
  "GHS", "GIP", "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL", "HRK", "HTG", "HUF", "IDR", "ILS", "INR", "IQD", "IRR",
  "ISK", "JMD", "JOD", "JPY", "KES", "KGS", "KHR", "KMF", "KPW", "KRW", "KWD", "KYD", "KZT", "LAK", "LBP", "LKR",
  "LRD", "LSL", "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP", "MRU", "MUR", "MVR", "MWK", "MXN", "MYR",
  "MZN", "NAD", "NGN", "NIO", "NOK", "NPR", "NZD", "OMR", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN", "PYG", "QAR",
  "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG", "SEK", "SGD", "SHP", "SLE", "SLL", "SOS", "SRD", "SSP",
  "STN", "SVC", "SYP", "SZL", "THB", "TJS", "TMT", "TND", "TOP", "TRY", "TTD", "TWD", "TZS", "UAH", "UGX", "USD",
  "UYU", "UZS", "VES", "VND", "VUV", "WST", "XAF", "XCD", "XCG", "XDR", "XOF", "XPF", "XSU", "YER", "ZAR", "ZMW",
  "ZWG", "ZWL",
];

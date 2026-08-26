// Real ISO 4217 currency codes, used to validate the account currency
// field server-side — mirrors the dropdown built client-side in
// apps/web/src/composables/useCurrencyOptions.ts.
export const ISO_CURRENCY_CODES: readonly string[] =
  Intl.supportedValuesOf('currency');

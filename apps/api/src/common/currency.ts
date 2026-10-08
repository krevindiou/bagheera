// ISO 4217 codes validating the account currency; mirrors the web
// dropdown (apps/web/src/composables/useCurrencyOptions.ts).
export const ISO_CURRENCY_CODES: readonly string[] = Intl.supportedValuesOf('currency');

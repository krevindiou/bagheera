// Currency dropdown for account creation. Unlike useCountryOptions
// (Intl.supportedValuesOf has no "region" key), "currency" is a valid
// key per ECMA-402, so the code list is generated at runtime rather than
// hardcoded. Names come from Intl.DisplayNames, sorted alphabetically.

export interface CurrencyOption {
  code: string;
  name: string;
}

export function getCurrencyOptions(): CurrencyOption[] {
  const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });
  const toOption = (code: string): CurrencyOption => ({
    code,
    name: currencyNames.of(code) ?? code,
  });

  return Intl.supportedValuesOf("currency")
    .map(toOption)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Best-guess currency prefill for new accounts, derived from the visitor's
// browser-locale region. There's no Intl API mapping region → currency
// (unlike DisplayNames/supportedValuesOf above), so this table is static —
// each country's primary official currency. It's a starting point only;
// the field stays a normal, freely-changeable dropdown.
// prettier-ignore
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  AD: "EUR", AE: "AED", AF: "AFN", AG: "XCD", AI: "XCD", AL: "ALL", AM: "AMD", AO: "AOA",
  AR: "ARS", AS: "USD", AT: "EUR", AU: "AUD", AW: "AWG", AX: "EUR", AZ: "AZN", BA: "BAM",
  BB: "BBD", BD: "BDT", BE: "EUR", BF: "XOF", BG: "BGN", BH: "BHD", BI: "BIF", BJ: "XOF",
  BL: "EUR", BM: "BMD", BN: "BND", BO: "BOB", BQ: "USD", BR: "BRL", BS: "BSD", BT: "BTN",
  BW: "BWP", BY: "BYN", BZ: "BZD", CA: "CAD", CC: "AUD", CD: "CDF", CF: "XAF", CG: "XAF",
  CH: "CHF", CI: "XOF", CK: "NZD", CL: "CLP", CM: "XAF", CN: "CNY", CO: "COP", CR: "CRC",
  CU: "CUP", CV: "CVE", CW: "ANG", CX: "AUD", CY: "EUR", CZ: "CZK", DE: "EUR", DJ: "DJF",
  DK: "DKK", DM: "XCD", DO: "DOP", DZ: "DZD", EC: "USD", EE: "EUR", EG: "EGP", EH: "MAD",
  ER: "ERN", ES: "EUR", ET: "ETB", FI: "EUR", FJ: "FJD", FK: "FKP", FM: "USD", FO: "DKK",
  FR: "EUR", GA: "XAF", GB: "GBP", GD: "XCD", GE: "GEL", GF: "EUR", GG: "GBP", GH: "GHS",
  GI: "GIP", GL: "DKK", GM: "GMD", GN: "GNF", GP: "EUR", GQ: "XAF", GR: "EUR", GT: "GTQ",
  GU: "USD", GW: "XOF", GY: "GYD", HK: "HKD", HN: "HNL", HR: "EUR", HT: "HTG", HU: "HUF",
  ID: "IDR", IE: "EUR", IL: "ILS", IM: "GBP", IN: "INR", IO: "USD", IQ: "IQD", IR: "IRR",
  IS: "ISK", IT: "EUR", JE: "GBP", JM: "JMD", JO: "JOD", JP: "JPY", KE: "KES", KG: "KGS",
  KH: "KHR", KI: "AUD", KM: "KMF", KN: "XCD", KP: "KPW", KR: "KRW", KW: "KWD", KY: "KYD",
  KZ: "KZT", LA: "LAK", LB: "LBP", LC: "XCD", LI: "CHF", LK: "LKR", LR: "LRD", LS: "LSL",
  LT: "EUR", LU: "EUR", LV: "EUR", LY: "LYD", MA: "MAD", MC: "EUR", MD: "MDL", ME: "EUR",
  MF: "EUR", MG: "MGA", MH: "USD", MK: "MKD", ML: "XOF", MM: "MMK", MN: "MNT", MO: "MOP",
  MP: "USD", MQ: "EUR", MR: "MRU", MS: "XCD", MT: "EUR", MU: "MUR", MV: "MVR", MW: "MWK",
  MX: "MXN", MY: "MYR", MZ: "MZN", NA: "NAD", NC: "XPF", NE: "XOF", NF: "AUD", NG: "NGN",
  NI: "NIO", NL: "EUR", NO: "NOK", NP: "NPR", NR: "AUD", NU: "NZD", NZ: "NZD", OM: "OMR",
  PA: "PAB", PE: "PEN", PF: "XPF", PG: "PGK", PH: "PHP", PK: "PKR", PL: "PLN", PM: "EUR",
  PN: "NZD", PR: "USD", PS: "ILS", PT: "EUR", PW: "USD", PY: "PYG", QA: "QAR", RE: "EUR",
  RO: "RON", RS: "RSD", RU: "RUB", RW: "RWF", SA: "SAR", SB: "SBD", SC: "SCR", SD: "SDG",
  SE: "SEK", SG: "SGD", SH: "SHP", SI: "EUR", SJ: "NOK", SK: "EUR", SL: "SLE", SM: "EUR",
  SN: "XOF", SO: "SOS", SR: "SRD", SS: "SSP", ST: "STN", SV: "USD", SX: "ANG", SY: "SYP",
  SZ: "SZL", TC: "USD", TD: "XAF", TG: "XOF", TH: "THB", TJ: "TJS", TK: "NZD", TL: "USD",
  TM: "TMT", TN: "TND", TO: "TOP", TR: "TRY", TT: "TTD", TW: "TWD", TZ: "TZS", UA: "UAH",
  UG: "UGX", UM: "USD", US: "USD", UY: "UYU", UZ: "UZS", VA: "EUR", VC: "XCD", VE: "VES",
  VG: "USD", VI: "USD", VN: "VND", VU: "VUV", WF: "XPF", WS: "WST", YE: "YER", YT: "EUR",
  ZA: "ZAR", ZM: "ZMW", ZW: "ZWL",
};

export function getGuessedCurrency(options: CurrencyOption[]): string {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    const guess = region ? COUNTRY_TO_CURRENCY[region] : undefined;
    if (guess && options.some((option) => option.code === guess)) {
      return guess;
    }
  } catch {
    // Unparsable/unsupported locale — no guess, field stays blank.
  }

  return "";
}

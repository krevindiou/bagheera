import { toMajorUnits, type MinorUnits } from "@bagheera/money";

// Mirrors apps/api/src/common/money.ts's scale, via the shared
// @bagheera/money package both apps depend on — the API always returns
// stored amounts as integers (real value × 10,000). The API-response value
// is a plain `number` (branding doesn't survive JSON), hence the cast.
export function toDisplayAmount(minorUnits: number): number {
  return toMajorUnits(minorUnits as MinorUnits);
}

// Only English (`en`) is enabled currently — currency/date formatting
// follows the active locale, which is `en` for now.
const LOCALE = "en";

// Money inputs display the account currency symbol as an input add-on.
export function currencySymbol(currency: string): string {
  try {
    const part = new Intl.NumberFormat(LOCALE, { style: "currency", currency })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value ?? currency;
  } catch {
    return currency;
  }
}

// Date formatting follows the active locale, same as money. Accepts a
// stored `YYYY-MM-DD` date string and renders it localized.
export function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(LOCALE).format(parsed);
}

// Displayed amounts are localized currency strings in the account's
// currency. Accepts either a stored (×10,000) integer, or an
// already-converted decimal amount when `alreadyDisplayAmount` is true
// (some API responses, e.g. the dashboard, return decimal amounts already).
export function formatMoney(
  amount: number,
  currency: string,
  alreadyDisplayAmount = false,
): string {
  const value = alreadyDisplayAmount ? amount : toDisplayAmount(amount);
  try {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency }).format(value);
  } catch {
    // Unknown/invalid currency code — fall back to a plain decimal so the
    // page doesn't crash.
    return `${value.toFixed(2)} ${currency}`;
  }
}

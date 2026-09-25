import {
  currencyFractionDigits,
  MONEY_SCALE,
  toMajorUnits,
  type MinorUnits,
} from '@bagheera/money';
import { i18n } from '../../i18n';

// Every amount the API returns is an integer in minor units (real value ×
// 10,000, via the shared @bagheera/money package). The API-response value is
// a plain `number` (branding doesn't survive JSON), hence the cast.
//
// Converts to a plain decimal — rounded to the currency's own number of
// decimals when a currency is given, otherwise kept at full precision (for
// pre-filling an edit form).
export function toDisplayAmount(minorUnits: number, currency?: string): number {
  return toMajorUnits(
    minorUnits as MinorUnits,
    currency ? currencyFractionDigits(currency) : Math.log10(MONEY_SCALE),
  );
}

// Currency/date formatting follows the app's active i18n locale (switched
// via LanguageSwitcher.vue / router/index.ts's setLocale) — read live
// rather than captured once, so a locale switch re-renders every already-
// mounted amount/date without a page reload. `i18n.global.locale` is a
// plain ref (legacy: false, see i18n/index.ts), not a reactive composable
// binding, which is why these are plain functions reading `.value` at call
// time rather than computed()s — this module isn't a component.
function currentLocale(): string {
  return i18n.global.locale.value;
}

// Today's date as the stored `YYYY-MM-DD` string, the default value date of
// a new operation or scheduler.
export function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// Money inputs display the account currency symbol as an input add-on.
export function currencySymbol(currency: string): string {
  try {
    const part = new Intl.NumberFormat(currentLocale(), { style: 'currency', currency })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
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
  return new Intl.DateTimeFormat(currentLocale()).format(parsed);
}

// The same, for a full ISO timestamp (e.g. a passkey's `createdAt`):
// renders the calendar date it falls on in the viewer's time zone.
export function formatTimestampDate(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return timestamp;
  return new Intl.DateTimeFormat(currentLocale()).format(parsed);
}

// Chart helpers: charts plot decimal amounts, so series points (rounded to
// the currency's decimals) and axis bounds (unrounded, they're only hints)
// are converted from the API's minor units before they reach Chart.js.
export function toDisplayPoints(
  points: { period: string; value: number }[],
  currency: string,
): { period: string; value: number }[] {
  return points.map((point) => ({
    period: point.period,
    value: toDisplayAmount(point.value, currency),
  }));
}

export function toDisplayBounds(
  bounds: { min: number; max: number } | null | undefined,
): { min: number; max: number } | null {
  return bounds ? { min: bounds.min / MONEY_SCALE, max: bounds.max / MONEY_SCALE } : null;
}

// Localized currency string for a decimal amount (e.g. a chart value already
// converted with toDisplayAmount).
export function formatDisplayMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(currentLocale(), { style: 'currency', currency }).format(value);
  } catch {
    // Unknown/invalid currency code — fall back to a plain decimal so the
    // page doesn't crash.
    return `${value.toFixed(2)} ${currency}`;
  }
}

// Displayed amounts are localized currency strings in the account's
// currency, formatted from an API minor-units integer.
export function formatMoney(minorUnits: number, currency: string): string {
  return formatDisplayMoney(toDisplayAmount(minorUnits, currency), currency);
}

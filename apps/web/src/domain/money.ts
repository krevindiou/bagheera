import {
  currencyFractionDigits,
  MONEY_SCALE,
  toMajorUnits,
  type MinorUnits,
} from '@bagheera/money';
import { i18n } from '../i18n';

// API minor units (a plain `number`: brands don't survive JSON) to a
// decimal, rounded to the currency's decimals when one is given, else at
// full precision (to pre-fill an edit form).
export function toDisplayAmount(minorUnits: number, currency?: string): number {
  return toMajorUnits(
    minorUnits as MinorUnits,
    currency ? currencyFractionDigits(currency) : Math.log10(MONEY_SCALE),
  );
}

// Formatting follows the active i18n locale, read at call time so a
// locale switch re-renders mounted amounts and dates.
function currentLocale(): string {
  return i18n.global.locale.value;
}

// Today's date as the stored `YYYY-MM-DD` string, the default value date of
// a new operation or scheduler: in the member's own time zone when given
// (the same one the API's "today" follows), else the browser's.
export function today(timeZone?: string): string {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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

// A stored `YYYY-MM-DD` date, localized.
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

// A decimal amount (e.g. from toDisplayAmount) as localized currency.
export function formatDisplayMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(currentLocale(), { style: 'currency', currency }).format(value);
  } catch {
    // Unknown currency code.
    return `${value.toFixed(2)} ${currency}`;
  }
}

// An API minor-units amount as localized currency.
export function formatMoney(minorUnits: number, currency: string): string {
  return formatDisplayMoney(toDisplayAmount(minorUnits, currency), currency);
}

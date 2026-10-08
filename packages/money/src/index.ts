// The money kernel shared by apps/api (common/money.ts) and apps/web
// (domain/money.ts).

// Monetary amounts are stored as integers equal to the real value
// multiplied by 10,000 (four decimal places); the boundary conversion
// rounds to the nearest integer after multiplication.
export const MONEY_SCALE = 10000;

// Sanity ceiling on an entered amount (major units), stored or used as a
// search threshold: keeps toMinorUnits() well clear of float precision
// loss (Number.MAX_SAFE_INTEGER / MONEY_SCALE ≈ 900 billion).
export const AMOUNT_CEILING = 999_999_999.9999;

// Branded: a value only becomes MinorUnits through toMinorUnits or an
// explicit cast where it already is one (a SQL aggregate, an API `number`,
// the result of `+`/`-`). A string tag, since a `unique symbol` can't be
// named in generated .d.ts files (TS4053).
export type MinorUnits = number & { readonly __brand: 'MinorUnits' };
export type MajorUnits = number & { readonly __brand: 'MajorUnits' };

export function toMinorUnits(value: number): MinorUnits {
  return Math.round(value * MONEY_SCALE) as MinorUnits;
}

// Inverse conversion, rounded to `fractionDigits` decimal places (two by
// default; pass currencyFractionDigits(currency) for the currency's own).
export function toMajorUnits(value: MinorUnits, fractionDigits = 2): MajorUnits {
  const factor = Math.pow(10, fractionDigits);
  return (Math.round((value / MONEY_SCALE) * factor) / factor) as MajorUnits;
}

// How many decimals a currency's amounts have (2 for EUR, 0 for JPY, 3 for
// KWD), from the runtime's own currency data; 2 for an unknown code.
export function currencyFractionDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

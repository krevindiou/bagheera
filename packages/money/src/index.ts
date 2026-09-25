// The shared money kernel. apps/api and apps/web both depend on this
// package instead of each carrying their own copy of the scale factor, the
// minor/major-unit conversion, and the amount sanity ceiling — see
// apps/api/src/common/money.ts and apps/web/src/pages/operations/money.ts,
// both thin re-exports of this.

// Monetary amounts are stored as integers equal to the real value
// multiplied by 10,000 (four decimal places); the boundary conversion
// rounds to the nearest integer after multiplication.
export const MONEY_SCALE = 10000;

// A sanity ceiling on a member-entered amount (major units, pre-conversion)
// — not a realistic transaction size, but a bound that keeps
// toMinorUnits()'s ×MONEY_SCALE scaling well clear of floating-point
// precision loss and the debit/credit columns' bigint range
// (Number.MAX_SAFE_INTEGER / MONEY_SCALE is ~900 billion; this leaves
// three orders of magnitude of headroom below that). The same ceiling
// applies to a stored amount and to a search filter's comparator
// threshold — both go through the same ×MONEY_SCALE conversion, so both
// need the same overflow-safety margin regardless of sign.
export const AMOUNT_CEILING = 999_999_999.9999;

// Branded so a stored minor-units integer can't be passed where plain
// arithmetic (or a major-units value) is expected without going through
// toMinorUnits/toMajorUnits — or an explicit `as MinorUnits` at a spot that
// already holds a minor-units value the caller can't get branded for free
// (a raw SQL aggregate's parsed result, an API response's plain `number`,
// or the far side of a `+`/`-` that always widens back to plain `number`).
//
// A string-literal tag, not a `unique symbol` — a symbol-tagged type can't
// be named in a generated .d.ts (TS4053) once it shows up in a public
// method's inferred return type, which every service method touching a
// debit/credit column does.
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

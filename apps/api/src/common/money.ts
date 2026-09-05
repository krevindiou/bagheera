// Monetary amounts are stored as integers equal to the real value
// multiplied by 10,000 (four decimal places); the boundary conversion
// rounds to the nearest integer after multiplication.
export const MONEY_SCALE = 10000;

// Branded so a stored minor-units integer can't be passed where plain
// arithmetic (or a major-units value) is expected without going through
// toMinorUnits/toMajorUnits — or an explicit `as MinorUnits` at a spot that
// already holds a minor-units value Drizzle can't type for us (a raw SQL
// aggregate's parsed result, or the far side of a `+`/`-` that always
// widens back to plain `number`). db/schema/operation.ts and scheduler.ts's
// debit/credit columns carry this brand at the schema level, so it's not
// just these two functions' own callers who get checked — every read of
// those columns is MinorUnits from the moment Drizzle returns the row.
//
// A string-literal tag, not a `unique symbol` — a symbol-tagged type can't
// be named in a generated .d.ts (TS4053) once it shows up in a public
// method's inferred return type, which every service method touching one
// of these columns does.
export type MinorUnits = number & { readonly __brand: 'MinorUnits' };
export type MajorUnits = number & { readonly __brand: 'MajorUnits' };

export function toMinorUnits(value: number): MinorUnits {
  return Math.round(value * MONEY_SCALE) as MinorUnits;
}

// Inverse conversion, rounded to two decimal places (currency units).
export function toMajorUnits(value: MinorUnits): MajorUnits {
  return (Math.round((value / MONEY_SCALE) * 100) / 100) as MajorUnits;
}

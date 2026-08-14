// Monetary amounts are stored as integers equal to the real value
// multiplied by 10,000 (four decimal places); the boundary conversion
// rounds to the nearest integer after multiplication.
export const MONEY_SCALE = 10000;

export function toMinorUnits(value: number): number {
  return Math.round(value * MONEY_SCALE);
}

// Inverse conversion, rounded to two decimal places (currency units).
export function toMajorUnits(value: number): number {
  return Math.round((value / MONEY_SCALE) * 100) / 100;
}

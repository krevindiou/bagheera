// Mirrors apps/api/src/common/money.ts's scale — the API always returns
// stored amounts as integers (real value × 10,000).
const MONEY_SCALE = 10000;

export function toDisplayAmount(minorUnits: number): number {
  return Math.round((minorUnits / MONEY_SCALE) * 100) / 100;
}

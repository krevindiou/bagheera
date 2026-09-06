// Thin re-export: the money kernel (scale factor, minor/major-unit brands
// and conversion, amount sanity ceiling) lives in packages/money, shared
// with apps/web (see apps/web/src/pages/operations/money.ts). Kept as a
// local module so existing imports across apps/api/src don't change.
export {
  MONEY_SCALE,
  AMOUNT_CEILING,
  toMinorUnits,
  toMajorUnits,
} from '@bagheera/money';
export type { MinorUnits, MajorUnits } from '@bagheera/money';

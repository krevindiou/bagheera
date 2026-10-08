// Vertical-axis bounds for every time-series chart (reports, synthesis
// chart): data min/max padded by 5% of the spread, the padding rounded up
// to two significant digits. Flat data pads by 5% of its absolute value;
// all-zero data gets [-1, +1] currency units. Minor-unit values.

import { MONEY_SCALE } from './money';
import { AxisBoundsDto } from './dto/chart-response.dto';

export type AxisBounds = AxisBoundsDto;

// Rounds a non-negative magnitude up to two significant digits — e.g.
// 1.85 -> 1.9, 12.5 -> 13, 5 -> 5.
function roundOutwardMagnitude(magnitude: number): number {
  if (magnitude === 0) {
    return 0;
  }
  const exponent = Math.floor(Math.log10(magnitude));
  const unit = Math.pow(10, exponent - 1);
  return Math.ceil(magnitude / unit) * unit;
}

export function computeAxisBounds(min: number, max: number): AxisBounds {
  const spread = max - min;
  if (spread === 0) {
    if (min === 0) {
      return { min: -MONEY_SCALE, max: MONEY_SCALE };
    }
    const padding = roundOutwardMagnitude(Math.abs(min) * 0.05);
    return { min: min - padding, max: max + padding };
  }
  const padding = roundOutwardMagnitude(spread * 0.05);
  return { min: min - padding, max: max + padding };
}

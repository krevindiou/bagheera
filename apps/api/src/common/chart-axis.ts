// Shared vertical-axis-bounds formula for every time-series chart (report
// charts, the dashboard/per-account synthesis chart): the data min/max
// stretched outward by 5% of the spread, rounded outward to two
// significant digits. Flat data pads by 5% of the absolute value instead;
// all-zero data defaults to [-1, +1] currency units.

export interface AxisBounds {
  min: number;
  max: number;
}

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
      return { min: -1, max: 1 };
    }
    const padding = roundOutwardMagnitude(Math.abs(min) * 0.05);
    return { min: min - padding, max: max + padding };
  }
  const padding = roundOutwardMagnitude(spread * 0.05);
  return { min: min - padding, max: max + padding };
}

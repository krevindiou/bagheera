import { computeAxisBounds } from './chart-axis';

describe('computeAxisBounds', () => {
  it('defaults to one currency unit either side for all-zero flat data', () => {
    expect(computeAxisBounds(0, 0)).toEqual({ min: -10000, max: 10000 });
  });

  it('pads flat non-zero data by 5% of its magnitude, rounded outward', () => {
    // |200| * 5% = 10 -> rounds outward to two significant digits: 10.
    const bounds = computeAxisBounds(200, 200);
    expect(bounds.min).toBeCloseTo(190, 6);
    expect(bounds.max).toBeCloseTo(210, 6);
  });

  it('pads a spread by 5% of the spread, rounded outward', () => {
    // spread = 100 -> 5% = 5 -> already two significant digits.
    const bounds = computeAxisBounds(0, 100);
    expect(bounds.min).toBeCloseTo(-5, 6);
    expect(bounds.max).toBeCloseTo(105, 6);
  });

  it('rounds the padding outward to two significant digits (1.85 -> 1.9)', () => {
    // spread = 37 -> 5% = 1.85 -> rounds outward to 1.9.
    const bounds = computeAxisBounds(0, 37);
    expect(bounds.min).toBeCloseTo(-1.9, 6);
    expect(bounds.max).toBeCloseTo(38.9, 6);
  });

  it('rounds the padding outward to two significant digits (12.5 -> 13)', () => {
    // spread = 250 -> 5% = 12.5 -> rounds outward to 13.
    const bounds = computeAxisBounds(0, 250);
    expect(bounds.min).toBeCloseTo(-13, 6);
    expect(bounds.max).toBeCloseTo(263, 6);
  });

  it('handles a negative-only range', () => {
    const bounds = computeAxisBounds(-100, -50);
    // spread = 50 -> 5% = 2.5 -> rounds outward to 2.5 (already two sig figs).
    expect(bounds.min).toBeCloseTo(-102.5, 6);
    expect(bounds.max).toBeCloseTo(-47.5, 6);
  });
});

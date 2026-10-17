import { computeAxisBounds } from './chart-axis';

describe('computeAxisBounds', () => {
  it('defaults to zero up to one currency unit for all-zero flat data', () => {
    expect(computeAxisBounds(0, 0)).toEqual({ min: 0, max: 10000 });
  });

  it('pads a spread by 5% of the spread, rounded outward', () => {
    // spread = 100 -> 5% = 5 -> already two significant digits.
    const bounds = computeAxisBounds(-50, 50);
    expect(bounds.min).toBeCloseTo(-55, 6);
    expect(bounds.max).toBeCloseTo(55, 6);
  });

  it('rounds the padding outward to two significant digits (1.85 -> 1.9)', () => {
    // spread = 37 -> 5% = 1.85 -> rounds outward to 1.9.
    const bounds = computeAxisBounds(-10, 27);
    expect(bounds.min).toBeCloseTo(-11.9, 6);
    expect(bounds.max).toBeCloseTo(28.9, 6);
  });

  it('rounds the padding outward to two significant digits (12.5 -> 13)', () => {
    // spread = 250 -> 5% = 12.5 -> rounds outward to 13.
    const bounds = computeAxisBounds(-100, 150);
    expect(bounds.min).toBeCloseTo(-113, 6);
    expect(bounds.max).toBeCloseTo(163, 6);
  });

  it('keeps the padding on both sides when the data crosses zero', () => {
    const bounds = computeAxisBounds(-20, 80);
    expect(bounds.min).toBeCloseTo(-25, 6);
    expect(bounds.max).toBeCloseTo(85, 6);
  });

  it('keeps the minimum at 0 for all-positive data', () => {
    const bounds = computeAxisBounds(50, 150);
    expect(bounds.min).toBe(0);
    expect(bounds.max).toBeCloseTo(155, 6);
  });

  it('keeps the minimum at 0 when the data minimum is exactly 0', () => {
    const bounds = computeAxisBounds(0, 100);
    expect(bounds.min).toBe(0);
    expect(bounds.max).toBeCloseTo(105, 6);
  });

  it('pads flat positive data by 5% of its magnitude, rounded outward, above 0', () => {
    // |200| * 5% = 10 -> rounds outward to two significant digits: 10.
    const bounds = computeAxisBounds(200, 200);
    expect(bounds.min).toBe(0);
    expect(bounds.max).toBeCloseTo(210, 6);
  });

  it('keeps the maximum at 0 for all-negative data', () => {
    const bounds = computeAxisBounds(-100, -50);
    // spread = 50 -> 5% = 2.5 -> rounds outward to 2.5 (already two sig figs).
    expect(bounds.min).toBeCloseTo(-102.5, 6);
    expect(bounds.max).toBe(0);
  });

  it('keeps the maximum at 0 when the data maximum is exactly 0', () => {
    const bounds = computeAxisBounds(-100, 0);
    expect(bounds.min).toBeCloseTo(-105, 6);
    expect(bounds.max).toBe(0);
  });

  it('pads flat negative data by 5% of its magnitude, rounded outward, below 0', () => {
    const bounds = computeAxisBounds(-200, -200);
    expect(bounds.min).toBeCloseTo(-210, 6);
    expect(bounds.max).toBe(0);
  });
});

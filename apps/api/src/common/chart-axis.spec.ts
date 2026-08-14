import { computeAxisBounds } from './chart-axis';

describe('computeAxisBounds', () => {
  it('pads a normal spread by 5%, rounded outward to two significant digits', () => {
    expect(computeAxisBounds(100, 200)).toEqual({ min: 95, max: 205 });
  });

  it('rounds the padding up, not to the nearest value', () => {
    // spread 37 -> 5% = 1.85 -> rounded outward to 1.9
    expect(computeAxisBounds(10, 47)).toEqual({ min: 8.1, max: 48.9 });
  });

  it('is direction-safe for negative values', () => {
    expect(computeAxisBounds(-200, -100)).toEqual({ min: -205, max: -95 });
  });

  it('pads flat non-zero data by 5% of the absolute value', () => {
    // 5% of 250 = 12.5 -> rounded outward to 13
    expect(computeAxisBounds(250, 250)).toEqual({ min: 237, max: 263 });
  });

  it('defaults all-zero data to [-1, +1]', () => {
    expect(computeAxisBounds(0, 0)).toEqual({ min: -1, max: 1 });
  });
});

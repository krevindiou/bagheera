import { MinorUnits, MONEY_SCALE, toMajorUnits, toMinorUnits } from './money';

describe('toMinorUnits', () => {
  it('scales by MONEY_SCALE', () => {
    expect(toMinorUnits(1)).toBe(10000);
    expect(MONEY_SCALE).toBe(10000);
  });

  it('rounds to the nearest integer after scaling', () => {
    expect(toMinorUnits(1.23456)).toBe(12346);
  });

  it('is sign-preserving', () => {
    expect(toMinorUnits(-50)).toBe(-500000);
  });

  it('maps zero to zero', () => {
    expect(toMinorUnits(0)).toBe(0);
  });
});

describe('toMajorUnits', () => {
  it('is the inverse scale, rounded to two decimal places', () => {
    expect(toMajorUnits(toMinorUnits(123.45))).toBe(123.45);
  });

  it('rounds to two decimal places rather than returning the raw division', () => {
    // 10001 / 10000 = 1.0001 -> rounds to 1, not 1.0001
    expect(toMajorUnits(10001 as MinorUnits)).toBe(1);
  });

  it('is sign-preserving', () => {
    expect(toMajorUnits(toMinorUnits(-50))).toBe(-50);
  });

  it('maps zero to zero', () => {
    expect(toMajorUnits(toMinorUnits(0))).toBe(0);
  });
});

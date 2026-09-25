import { describe, expect, it } from 'vitest';
import {
  AMOUNT_CEILING,
  currencyFractionDigits,
  MONEY_SCALE,
  MinorUnits,
  toMajorUnits,
  toMinorUnits,
} from './index';

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

describe('AMOUNT_CEILING', () => {
  it('leaves toMinorUnits well clear of Number.MAX_SAFE_INTEGER', () => {
    expect(toMinorUnits(AMOUNT_CEILING)).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });

  it('is exactly the documented value — pins the boundary DTOs and schemas validate against', () => {
    expect(AMOUNT_CEILING).toBe(999_999_999.9999);
  });
});

describe('currencyFractionDigits', () => {
  it("returns the currency's own number of decimals", () => {
    expect(currencyFractionDigits('EUR')).toBe(2);
    expect(currencyFractionDigits('JPY')).toBe(0);
    expect(currencyFractionDigits('KWD')).toBe(3);
  });

  it('falls back to 2 for an unknown code', () => {
    expect(currencyFractionDigits('NOTACODE')).toBe(2);
  });
});

describe('toMajorUnits fraction digits', () => {
  it('rounds to the requested number of decimals', () => {
    expect(toMajorUnits(123456 as MinorUnits, 3)).toBe(12.346);
    expect(toMajorUnits(123456 as MinorUnits, 0)).toBe(12);
  });
});

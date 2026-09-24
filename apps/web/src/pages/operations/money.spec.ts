import { describe, expect, it, vi } from 'vitest';
import { currencySymbol, formatDate, formatMoney, toDisplayAmount, today } from './money';

describe('toDisplayAmount', () => {
  it('converts a stored minor-units integer to a major-unit decimal', () => {
    expect(toDisplayAmount(123456)).toBe(12.35);
    expect(toDisplayAmount(0)).toBe(0);
    expect(toDisplayAmount(-50000)).toBe(-5);
  });
});

describe('currencySymbol', () => {
  it('returns the symbol for a known ISO currency code', () => {
    expect(currencySymbol('USD')).toBe('$');
    expect(currencySymbol('EUR')).toBe('€');
  });

  it("falls back to the raw code when Intl can't resolve a currency", () => {
    expect(currencySymbol('NOTACODE')).toBe('NOTACODE');
  });

  it('falls back to the raw code when Intl succeeds but reports no currency part', () => {
    // Intl.NumberFormat is called with `new` in currencySymbol()'s real
    // implementation — a mock replacement has to stay constructor-compatible
    // (a plain arrow function isn't; vitest warns about exactly this).
    const spy = vi.spyOn(Intl, 'NumberFormat').mockImplementation(function () {
      return {
        formatToParts: () => [{ type: 'integer', value: '0' }],
      } as unknown as Intl.NumberFormat;
    });
    expect(currencySymbol('USD')).toBe('USD');
    spy.mockRestore();
  });
});

describe('formatDate', () => {
  it('formats a stored YYYY-MM-DD date in the active locale', () => {
    expect(formatDate('2026-01-15')).toBe('1/15/2026');
  });

  it("returns the raw string when it doesn't parse as a date", () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatMoney', () => {
  it('formats a stored minor-units amount as localized currency', () => {
    expect(formatMoney(123456, 'USD')).toBe('$12.35');
  });

  it('treats the amount as already-major-units when alreadyDisplayAmount is true', () => {
    expect(formatMoney(12.35, 'USD', true)).toBe('$12.35');
  });

  it('falls back to a plain decimal string for an unknown currency', () => {
    expect(formatMoney(123456, 'NOTACODE')).toBe('12.35 NOTACODE');
  });
});

describe('today', () => {
  it("returns today's date as a stored YYYY-MM-DD string", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T10:30:00Z'));

    expect(today()).toBe('2026-09-24');

    vi.useRealTimers();
  });
});

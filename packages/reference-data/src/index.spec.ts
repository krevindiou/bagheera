import { describe, expect, it } from 'vitest';
import {
  COUNTRY_CODES,
  DEFAULT_LOCALE,
  isoDateIn,
  isValueDate,
  MAX_VALUE_DATE,
  MIN_VALUE_DATE,
  PAYMENT_METHOD_ID,
  SUPPORTED_LOCALES,
  TRANSFER_PAYMENT_METHOD_IDS,
} from './index';

describe('PAYMENT_METHOD_ID', () => {
  it('has a distinct id for every payment method', () => {
    const ids = Object.values(PAYMENT_METHOD_ID);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('TRANSFER_PAYMENT_METHOD_IDS', () => {
  it('is exactly the transfer debit/credit ids', () => {
    expect(TRANSFER_PAYMENT_METHOD_IDS).toEqual([
      PAYMENT_METHOD_ID.TRANSFER_DEBIT,
      PAYMENT_METHOD_ID.TRANSFER_CREDIT,
    ]);
  });
});

describe('DEFAULT_LOCALE', () => {
  it('is one of SUPPORTED_LOCALES', () => {
    expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE);
  });
});

describe('COUNTRY_CODES', () => {
  it('holds distinct two-letter uppercase codes', () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    expect(COUNTRY_CODES.every((code) => /^[A-Z]{2}$/.test(code))).toBe(true);
  });
});

describe('isValueDate', () => {
  it.each([MIN_VALUE_DATE, MAX_VALUE_DATE, '2026-01-31', '2024-02-29', '2000-02-29'])(
    'accepts %s',
    (date) => {
      expect(isValueDate(date)).toBe(true);
    },
  );

  // Dates that would make a chart walk a million periods.
  it.each(['0001-01-01', '1899-12-31', '2101-01-01', '9999-12-31'])(
    'rejects %s, outside the accepted range',
    (date) => {
      expect(isValueDate(date)).toBe(false);
    },
  );

  it.each(['2024-02-30', '2023-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-00-10'])(
    'rejects %s, which is not a real calendar day',
    (date) => {
      expect(isValueDate(date)).toBe(false);
    },
  );

  // Other ISO 8601 shapes, which `date` columns and web date inputs never
  // produce.
  it.each(['2026-01-01T00:00:00Z', '2026-W01-1', '2026-001', '+2026-01-01', '2026-1-1', ''])(
    'rejects %s, which is not a plain YYYY-MM-DD date',
    (date) => {
      expect(isValueDate(date)).toBe(false);
    },
  );

  it.each([undefined, null, 20260101, new Date('2026-01-01')])('rejects non-string %p', (value) => {
    expect(isValueDate(value)).toBe(false);
  });
});

describe('isoDateIn', () => {
  // 23:30 UTC on Jan 1 is already Jan 2 in Paris and still Jan 1 in New York.
  const lateEvening = new Date('2026-01-01T23:30:00Z');

  it.each([
    ['UTC', '2026-01-01'],
    ['Europe/Paris', '2026-01-02'],
    ['America/New_York', '2026-01-01'],
  ])('reads the calendar day in %s', (timeZone, expected) => {
    expect(isoDateIn(timeZone, lateEvening)).toBe(expected);
  });
});

import { parseDate, parseAmount } from './cell-values';

describe('parseDate', () => {
  it.each([
    ['20260305', '2026-03-05'],
    ['20260305120000', '2026-03-05'],
    ['20260305120000.123', '2026-03-05'],
    ['20260305120000.000[-5:EST]', '2026-03-05'],
    ['20260305[0:GMT]', '2026-03-05'],
    [' 20240229 ', '2024-02-29'],
  ])('reads %j', (text, expected) => {
    expect(parseDate(text)).toEqual({ date: expected });
  });

  it.each(['20260231', '20250229', '20261301', '2026-03-05', '05/03/2026', '260305', '', 'x'])(
    'refuses %j',
    (text) => {
      expect(parseDate(text)).toEqual({ reason: 'date_invalid' });
    },
  );

  it('refuses a real day outside the allowed years', () => {
    expect(parseDate('18991231')).toEqual({ reason: 'date_out_of_range' });
    expect(parseDate('21010101')).toEqual({ reason: 'date_out_of_range' });
  });
});

describe('parseAmount', () => {
  it.each([
    ['-12.50', true, 125000],
    ['-12,50', true, 125000],
    ['12.5', false, 125000],
    ['+1234.56', false, 12345600],
    ['-0.5678', true, 5678],
    ['7', false, 70000],
    ['0.0001', false, 1],
    ['999999999.9999', false, 9999999999999],
    ['1,234', false, 12340],
    [' 12.50 ', false, 125000],
  ])('reads %j', (text, negative, minor) => {
    expect(parseAmount(text)).toEqual({ negative, minor });
  });

  it.each([
    '12.34567',
    '1,234.50',
    '1.234,50',
    '1 234.50',
    '€12.50',
    '12.50 EUR',
    '(12.50)',
    '12.',
    '.5',
    '--1',
    '',
    'abc',
  ])('refuses %j rather than guessing', (text) => {
    expect(parseAmount(text)).toBe('amount_invalid');
  });

  it('refuses zero and amounts above the ceiling', () => {
    expect(parseAmount('0')).toBe('amount_zero');
    expect(parseAmount('-0.00')).toBe('amount_zero');
    expect(parseAmount('1000000000')).toBe('amount_too_large');
    expect(parseAmount('99999999999999999999')).toBe('amount_too_large');
    expect(parseAmount('999999999.9999')).not.toBe('amount_too_large');
  });
});

import type { OfxRow } from '../ofx';
import { parseBalance } from './cell-values';
import { readRows } from './read-rows';
import { totalsOf, importedNetUpTo } from './statement-summary';

function ofxRow(overrides: Partial<OfxRow> = {}): OfxRow {
  return {
    date: '20260305',
    amount: '-1',
    type: null,
    name: 'x',
    memo: '',
    reference: null,
    ...overrides,
  };
}

describe('statement summary', () => {
  const rows = readRows([
    ofxRow({ date: '20260310', amount: '-12.50' }),
    ofxRow({ date: '20260301', amount: '1000' }),
    ofxRow({ date: '20260320', amount: '-7.25' }),
    ofxRow({ date: 'nope', amount: '-1' }),
  ]);

  it('gives the period and the totals of the valid rows', () => {
    expect(totalsOf(rows)).toEqual({
      periodStart: '2026-03-01',
      periodEnd: '2026-03-20',
      debit: 197500,
      credit: 10000000,
    });
  });

  it('gives no period for a file without a valid row', () => {
    expect(totalsOf(readRows([ofxRow({ amount: 'x' })]))).toEqual({
      periodStart: null,
      periodEnd: null,
      debit: 0,
      credit: 0,
    });
  });

  it('adds up the rows to import up to a date, and not the skipped ones', () => {
    expect(importedNetUpTo(rows, '2026-03-10')).toBe(10000000 - 125000);
    const skipped = rows.map((row) =>
      row.status === 'invalid' ? row : { ...row, status: 'skipped' as const },
    );
    expect(importedNetUpTo(skipped, '2026-12-31')).toBe(0);
  });

  it.each([
    [
      { amount: '-1234.56', date: '20260331120000' },
      { minor: -12345600, date: '2026-03-31' },
    ],
    [
      { amount: '0', date: '20260331' },
      { minor: 0, date: '2026-03-31' },
    ],
    [
      { amount: '12,5', date: '20260331' },
      { minor: 125000, date: '2026-03-31' },
    ],
  ])('reads the closing balance %j', (closing, expected) => {
    expect(parseBalance(closing)).toEqual(expected);
  });

  it.each([
    [{ amount: 'abc', date: '20260331' }],
    [{ amount: '1', date: '20261331' }],
    [{ amount: '1e9', date: '20260331' }],
  ])('reads no closing balance from %j', (closing) => {
    expect(parseBalance(closing)).toBeNull();
  });
});

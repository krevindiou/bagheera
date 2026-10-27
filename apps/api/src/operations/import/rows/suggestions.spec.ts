import { PAYMENT_METHOD_ID } from '@bagheera/reference-data';
import type { OfxRow } from '../ofx';
import { type LabelRules } from './labels';
import { readRows } from './read-rows';
import { type ReadyRow, type RowOutcome } from './types';
import {
  withPaymentMethods,
  withCategories,
  withTransfers,
  type MethodUse,
  type CategoryUse,
  type TransferUse,
} from './suggestions';

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

describe('withCategories', () => {
  const use = (overrides: Partial<CategoryUse> = {}): CategoryUse => ({
    type: 'debit',
    thirdParty: 'bakery',
    categoryId: 'food',
    uses: 1,
    lastDate: '2026-01-01',
    ...overrides,
  });
  const read = (...rows: Partial<OfxRow>[]) =>
    readRows(rows.map((row) => ofxRow({ amount: '-5', ...row })));
  const categoryOf = (rows: ReturnType<typeof readRows>, index = 0) => {
    const row = rows[index] as ReadyRow;
    return [row.categoryId, row.categoryOrigin];
  };

  it('gives a row the category of its third party, ignoring case and spaces', () => {
    const rows = withCategories(read({ name: ' BAKERY ' }), [use()]);
    expect(categoryOf(rows)).toEqual(['food', 'history']);
  });

  it('leaves a row without history uncategorized', () => {
    const rows = withCategories(read({ name: 'Garage' }), [use()]);
    expect(categoryOf(rows)).toEqual([null, null]);
  });

  it('keeps debits and credits apart', () => {
    const rows = withCategories(read({ name: 'Bakery', amount: '5' }), [use()]);
    expect(categoryOf(rows)).toEqual([null, null]);
  });

  it('takes the category used most often', () => {
    const rows = withCategories(read({ name: 'Bakery' }), [
      use({ categoryId: 'food', uses: 2 }),
      use({ categoryId: 'gift', uses: 5 }),
    ]);
    expect(categoryOf(rows)).toEqual(['gift', 'history']);
  });

  it('takes the most recent category on a tie', () => {
    const usage = [
      use({ categoryId: 'food', lastDate: '2026-02-01' }),
      use({ categoryId: 'gift', lastDate: '2026-03-01' }),
    ];
    expect(categoryOf(withCategories(read({ name: 'Bakery' }), usage))).toEqual([
      'gift',
      'history',
    ]);
    expect(categoryOf(withCategories(read({ name: 'Bakery' }), usage.reverse()))).toEqual([
      'gift',
      'history',
    ]);
  });

  it('prefers a picked category, or none, to the suggestion', () => {
    const rows = read({ name: 'Bakery' }, { name: 'Bakery' }, { name: 'Bakery' });
    const result = withCategories(
      rows,
      [use()],
      new Map<number, string | null>([
        [1, 'gift'],
        [2, null],
      ]),
    );
    expect(categoryOf(result, 0)).toEqual(['gift', 'picked']);
    expect(categoryOf(result, 1)).toEqual([null, null]);
    expect(categoryOf(result, 2)).toEqual(['food', 'history']);
  });

  it('leaves an invalid row untouched', () => {
    const rows = withCategories(read({ name: 'Bakery', date: null }), [use()], new Map([[1, 'x']]));
    expect(rows[0]).toMatchObject({ status: 'invalid' });
  });
});

describe('withTransfers', () => {
  const use = (overrides: Partial<TransferUse> = {}): TransferUse => ({
    type: 'debit',
    thirdParty: 'savings top-up',
    accountId: 'acc-2',
    uses: 1,
    lastDate: '2026-01-01',
    ...overrides,
  });
  const read = (...rows: Partial<OfxRow>[]) =>
    readRows(
      rows.map((row) => ofxRow({ amount: '-5', type: 'XFER', name: 'Savings top-up', ...row })),
    );
  const accountOf = (rows: RowOutcome[], index = 0) => {
    const row = rows[index] as ReadyRow;
    return [row.transferAccountId, row.transferAccountOrigin];
  };

  it('gives a transfer row the account picked for its line', () => {
    const result = withTransfers(read({}, {}), [], new Map([[2, 'acc-2']]));
    expect([accountOf(result, 0), accountOf(result, 1)]).toEqual([
      [null, null],
      ['acc-2', 'picked'],
    ]);
  });

  it('serves a credit transfer as well as a debit one', () => {
    const result = withTransfers(read({ amount: '5' }), [], new Map([[1, 'acc-2']]));
    expect(accountOf(result)).toEqual(['acc-2', 'picked']);
  });

  it('suggests the account of earlier transfers of the same third party and type', () => {
    const rows = read({ name: ' SAVINGS TOP-UP ' }, { amount: '5' }, { name: 'Other' });
    const result = withTransfers(rows, [use()]);
    expect([accountOf(result, 0), accountOf(result, 1), accountOf(result, 2)]).toEqual([
      ['acc-2', 'history'],
      [null, null],
      [null, null],
    ]);
  });

  it('takes the account used most, then the most recent on a tie', () => {
    const rows = read({});
    expect(
      accountOf(withTransfers(rows, [use({ uses: 1 }), use({ accountId: 'acc-3', uses: 4 })])),
    ).toEqual(['acc-3', 'history']);
    const tie = [
      use({ lastDate: '2026-02-01' }),
      use({ accountId: 'acc-3', lastDate: '2026-03-01' }),
    ];
    expect(accountOf(withTransfers(rows, tie))).toEqual(['acc-3', 'history']);
    expect(accountOf(withTransfers(rows, tie.reverse()))).toEqual(['acc-3', 'history']);
  });

  it('prefers a pick, or an external transfer, to the suggestion', () => {
    const rows = read({}, {});
    const result = withTransfers(
      rows,
      [use()],
      new Map<number, string | null>([
        [1, 'acc-9'],
        [2, null],
      ]),
    );
    expect([accountOf(result, 0), accountOf(result, 1)]).toEqual([
      ['acc-9', 'picked'],
      [null, null],
    ]);
  });

  it('gives nothing to a row that is not a transfer', () => {
    const rows = read({ type: 'ATM' }, { name: 'Savings top-up', type: null });
    const result = withTransfers(
      rows,
      [use()],
      new Map([
        [1, 'acc-2'],
        [2, 'acc-2'],
      ]),
    );
    expect([accountOf(result, 0), accountOf(result, 1)]).toEqual([
      [null, null],
      [null, null],
    ]);
  });

  it('leaves an invalid row untouched', () => {
    const result = withTransfers(read({ date: null }), [use()], new Map([[1, 'acc-2']]));
    expect(result[0]).toMatchObject({ status: 'invalid' });
  });
});

describe('payment method origin', () => {
  const methodOf = (
    overrides: Partial<OfxRow>,
    rules?: LabelRules,
    picks = new Map<number, string>(),
  ) => readRows([ofxRow(overrides)], rules, picks)[0] as ReadyRow;

  it('is the default only when neither the type nor the label names a method', () => {
    expect(methodOf({ amount: '-1' }).paymentMethodOrigin).toBe('default');
    expect(methodOf({ amount: '1' }).paymentMethodOrigin).toBe('default');
    expect(methodOf({ type: 'ATM' }).paymentMethodOrigin).toBeNull();
    expect(methodOf({ name: 'PRLV EDF' }).paymentMethodOrigin).toBeNull();
  });

  it('is picked when the Member picked the method', () => {
    const row = methodOf({}, undefined, new Map([[1, PAYMENT_METHOD_ID.CHECK_DEBIT]]));
    expect(row.paymentMethodOrigin).toBe('picked');
    expect(row.paymentMethodId).toBe(PAYMENT_METHOD_ID.CHECK_DEBIT);
  });
});

describe('withPaymentMethods', () => {
  const use = (overrides: Partial<MethodUse> = {}): MethodUse => ({
    type: 'debit',
    thirdParty: 'bakery',
    paymentMethodId: PAYMENT_METHOD_ID.CHECK_DEBIT,
    uses: 1,
    lastDate: '2026-01-01',
    ...overrides,
  });
  const rows = (overrides: Partial<OfxRow> = {}) =>
    readRows([ofxRow({ name: 'Bakery', ...overrides })]);

  it('gives a row nothing named the method used most for its third party', () => {
    const [row] = withPaymentMethods(rows(), [
      use(),
      use({ paymentMethodId: PAYMENT_METHOD_ID.DIRECT_DEBIT, uses: 3 }),
    ]) as ReadyRow[];
    expect(row.paymentMethodId).toBe(PAYMENT_METHOD_ID.DIRECT_DEBIT);
    expect(row.paymentMethodOrigin).toBe('history');
  });

  it('breaks a tie with the most recent value date', () => {
    const [row] = withPaymentMethods(rows(), [
      use({ lastDate: '2026-01-01' }),
      use({ paymentMethodId: PAYMENT_METHOD_ID.DIRECT_DEBIT, lastDate: '2026-02-01' }),
    ]) as ReadyRow[];
    expect(row.paymentMethodId).toBe(PAYMENT_METHOD_ID.DIRECT_DEBIT);
  });

  it('compares third parties ignoring case and spaces, and types apart', () => {
    const [matched] = withPaymentMethods(rows({ name: ' BAKERY ' }), [use()]) as ReadyRow[];
    expect(matched.paymentMethodOrigin).toBe('history');
    const [other] = withPaymentMethods(rows(), [use({ type: 'credit' })]) as ReadyRow[];
    expect(other.paymentMethodOrigin).toBe('default');
  });

  it('leaves alone a row the file or the Member settled, and an invalid row', () => {
    const settled = rows({ type: 'ATM' });
    expect(withPaymentMethods(settled, [use()])).toEqual(settled);
    const invalid = readRows([ofxRow({ amount: 'x' })]);
    expect(withPaymentMethods(invalid, [use()])).toEqual(invalid);
  });
});

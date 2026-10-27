import { PAYMENT_METHOD_ID } from '@bagheera/reference-data';
import type { OfxRow } from '../ofx';
import { readRows } from './read-rows';
import { type ReadyRow, type RowOutcome } from './types';
import { shiftDays, markRecorded, type RecordedOperation, recordedWindows } from './recorded-match';

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

describe('markRecorded', () => {
  const row = (line: number, overrides: Partial<ReadyRow> = {}): ReadyRow => ({
    status: 'import',
    line,
    valueDate: '2026-03-05',
    type: 'debit',
    amount: 125000,
    thirdParty: 'Bakery',
    notes: '',
    paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
    paymentMethodOrigin: null,
    categoryId: null,
    categoryOrigin: null,
    transferAccountId: null,
    transferAccountOrigin: null,
    sourceLabel: 'Bakery',
    labelOrigin: 'file',
    bankReference: null,
    recorded: null,
    ...overrides,
  });

  const recorded = (overrides: Partial<RecordedOperation> = {}): RecordedOperation => ({
    valueDate: '2026-03-05',
    debit: 125000,
    credit: null,
    thirdParty: 'Bakery',
    sourceLabel: null,
    bankReference: null,
    id: 'op-1',
    reconciled: false,
    paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
    ...overrides,
  });

  const statuses = (rows: RowOutcome[]) => rows.map((r) => r.status);

  it('skips a row that matches a recorded operation, ignoring case and spaces', () => {
    expect(statuses(markRecorded([row(1, { thirdParty: ' BAKERY ' })], [recorded()]))).toEqual([
      'skipped',
    ]);
  });

  it('keeps a row that differs by date, side, amount or third party', () => {
    const rows = [
      row(1, { valueDate: '2026-03-08' }),
      row(2, { type: 'credit' }),
      row(3, { amount: 125001 }),
      row(4, { thirdParty: 'Butcher' }),
    ];
    expect(statuses(markRecorded(rows, [recorded()]))).toEqual([
      'import',
      'import',
      'import',
      'import',
    ]);
  });

  describe('a few days apart', () => {
    it('matches an operation typed a day or two before the bank posted it', () => {
      expect(statuses(markRecorded([row(1)], [recorded({ valueDate: '2026-03-04' })]))).toEqual([
        'skipped',
      ]);
      expect(statuses(markRecorded([row(1)], [recorded({ valueDate: '2026-03-07' })]))).toEqual([
        'skipped',
      ]);
      expect(markRecorded([row(1)], [recorded({ valueDate: '2026-03-04' })])[0]).toMatchObject({
        recorded: { matchedBy: 'details', valueDate: '2026-03-04' },
      });
    });

    it('matches on the label of the file as well as on the third party', () => {
      const edited = recorded({
        valueDate: '2026-03-04',
        thirdParty: 'Renamed',
        sourceLabel: 'BAKERY',
      });
      expect(statuses(markRecorded([row(1, { sourceLabel: 'bakery' })], [edited]))).toEqual([
        'skipped',
      ]);
    });

    it('keeps a row three days away, or whose label or amount differs', () => {
      const rows = [
        row(1, { valueDate: '2026-03-08' }),
        row(2, { thirdParty: 'Butcher', sourceLabel: 'Butcher' }),
        row(3, { amount: 125001 }),
      ];
      expect(statuses(markRecorded(rows, [recorded()]))).toEqual(['import', 'import', 'import']);
    });

    it('leaves a reconciled operation, or one imported before, to the exact date', () => {
      const early = { valueDate: '2026-03-04' };
      expect(statuses(markRecorded([row(1)], [recorded({ ...early, reconciled: true })]))).toEqual([
        'import',
      ]);
      expect(
        statuses(markRecorded([row(1)], [recorded({ ...early, bankReference: 'OTHER' })])),
      ).toEqual(['import']);
    });

    it('gives an exact date its operation before a nearby one takes it', () => {
      const rows = [row(1, { valueDate: '2026-03-06' }), row(2, { valueDate: '2026-03-05' })];
      const operations = [
        recorded({ id: 'op-exact', valueDate: '2026-03-05' }),
        recorded({ id: 'op-near', valueDate: '2026-03-07' }),
      ];
      const marked = markRecorded(rows, operations);
      expect(marked.map((r) => (r.status === 'skipped' ? r.recorded?.operationId : null))).toEqual([
        'op-near',
        'op-exact',
      ]);
    });

    it('takes the closest operation first', () => {
      const operations = [
        recorded({ id: 'op-far', valueDate: '2026-03-03' }),
        recorded({ id: 'op-close', valueDate: '2026-03-04' }),
      ];
      const [marked] = markRecorded([row(1)], operations);
      expect(marked).toMatchObject({ recorded: { operationId: 'op-close' } });
    });
  });

  it('matches a recorded credit by its side and amount', () => {
    const credit = row(1, { type: 'credit' });
    expect(statuses(markRecorded([credit], [recorded({ debit: null, credit: 125000 })]))).toEqual([
      'skipped',
    ]);
  });

  it('counts matches: n identical rows against m recorded skip min(n, m)', () => {
    const rows = [row(1), row(2), row(3)];
    expect(statuses(markRecorded(rows, [recorded(), recorded()]))).toEqual([
      'skipped',
      'skipped',
      'import',
    ]);
    expect(statuses(markRecorded([row(1)], [recorded(), recorded()]))).toEqual(['skipped']);
    expect(statuses(markRecorded(rows, []))).toEqual(['import', 'import', 'import']);
  });

  it('leaves invalid rows alone', () => {
    const invalid: RowOutcome = {
      status: 'invalid',
      line: 1,
      reason: 'date_invalid',
      sourceLabel: null,
    };
    expect(markRecorded([invalid], [recorded()])).toEqual([invalid]);
  });
});

describe('markRecorded with the bank reference', () => {
  const row = (line: number, overrides: Partial<ReadyRow> = {}): ReadyRow => ({
    status: 'import',
    line,
    valueDate: '2026-03-05',
    type: 'debit',
    amount: 125000,
    thirdParty: 'Bakery',
    notes: '',
    paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
    paymentMethodOrigin: null,
    categoryId: null,
    categoryOrigin: null,
    transferAccountId: null,
    transferAccountOrigin: null,
    sourceLabel: 'BAKERY',
    labelOrigin: 'file',
    bankReference: 'A1',
    recorded: null,
    ...overrides,
  });
  const recorded = (overrides: Partial<RecordedOperation> = {}): RecordedOperation => ({
    valueDate: '2026-03-05',
    debit: 125000,
    credit: null,
    thirdParty: 'Bakery',
    sourceLabel: 'BAKERY',
    bankReference: 'A1',
    id: 'op-1',
    reconciled: false,
    paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
    ...overrides,
  });
  const statuses = (rows: RowOutcome[]) => rows.map((r) => r.status);

  it('skips a row whatever the label of the operation became, and a few days off its date', () => {
    const edited = recorded({
      valueDate: '2026-03-20',
      thirdParty: 'Renamed',
      sourceLabel: null,
    });
    expect(statuses(markRecorded([row(1)], [edited]))).toEqual(['skipped']);
  });

  it('imports a row whose reference an operation of another period carries', () => {
    const reused = recorded({ valueDate: '2026-06-05' });
    expect(statuses(markRecorded([row(1)], [reused]))).toEqual(['import']);
    expect(statuses(markRecorded([row(1)], [recorded({ valueDate: '2026-04-05' })]))).toEqual([
      'skipped',
    ]);
    expect(statuses(markRecorded([row(1)], [recorded({ valueDate: '2026-04-06' })]))).toEqual([
      'import',
    ]);
  });

  it('imports a row whose reference an operation of another amount carries', () => {
    expect(statuses(markRecorded([row(1)], [recorded({ debit: 1 })]))).toEqual(['import']);
  });

  it('imports a row whose reference an operation of the other side carries', () => {
    const credit = recorded({ debit: null, credit: 125000 });
    expect(statuses(markRecorded([row(1)], [credit]))).toEqual(['import']);
  });

  it('leaves an operation of another amount to the row that matches it', () => {
    const rows = [row(1, { amount: 300000 }), row(2)];
    const operations = [recorded(), recorded({ id: 'op-other', debit: 300000 })];
    const matched = markRecorded(rows, operations).map((r) =>
      r.status === 'skipped' ? r.recorded?.operationId : null,
    );
    expect(matched).toEqual(['op-other', 'op-1']);
  });

  it('compares references exactly', () => {
    expect(
      statuses(
        markRecorded(
          [row(1, { bankReference: 'a1' })],
          [recorded({ thirdParty: 'x', sourceLabel: null })],
        ),
      ),
    ).toEqual(['import']);
  });

  it('falls back on date, amount and label for a row the references leave unmatched', () => {
    const rows = [row(1, { bankReference: 'NEW' }), row(2, { bankReference: null })];
    expect(statuses(markRecorded(rows, [recorded({ bankReference: 'OLD' })]))).toEqual([
      'skipped',
      'import',
    ]);
  });

  it('gives an operation to the row that matches its reference, not to an earlier row that only matches its label', () => {
    const rows = [row(1, { bankReference: 'NEW' }), row(2, { bankReference: 'A1' })];
    expect(statuses(markRecorded(rows, [recorded()]))).toEqual(['import', 'skipped']);
  });

  it('lets an operation absorb one row only, though two rows share a reference', () => {
    const rows = [row(1), row(2)];
    expect(statuses(markRecorded(rows, [recorded()]))).toEqual(['skipped', 'import']);
    expect(statuses(markRecorded(rows, [recorded(), recorded()]))).toEqual(['skipped', 'skipped']);
  });

  it('does not match a row without a reference on an operation that has one but differs', () => {
    expect(
      statuses(
        markRecorded(
          [row(1, { bankReference: null, thirdParty: 'Butcher', sourceLabel: 'BUTCHER' })],
          [recorded()],
        ),
      ),
    ).toEqual(['import']);
  });
});

describe('markRecorded with the label of the file', () => {
  const row = (overrides: Partial<ReadyRow> = {}): ReadyRow => ({
    status: 'import',
    line: 1,
    valueDate: '2026-03-05',
    type: 'debit',
    amount: 125000,
    thirdParty: 'Carrefour',
    notes: '',
    paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
    paymentMethodOrigin: null,
    categoryId: null,
    categoryOrigin: null,
    transferAccountId: null,
    transferAccountOrigin: null,
    sourceLabel: 'CARREFOUR MARKET',
    labelOrigin: 'correction',
    bankReference: null,
    recorded: null,
    ...overrides,
  });
  const recorded = (overrides: Partial<RecordedOperation> = {}): RecordedOperation => ({
    valueDate: '2026-03-05',
    debit: 125000,
    credit: null,
    thirdParty: 'Groceries',
    sourceLabel: 'carrefour market ',
    bankReference: null,
    id: 'op-1',
    reconciled: false,
    paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
    ...overrides,
  });

  it('skips a row whose label of the file equals the one the operation came from', () => {
    expect(markRecorded([row()], [recorded()])[0].status).toBe('skipped');
  });

  it('does not match on the label of the file when date or amount differ', () => {
    expect(markRecorded([row({ amount: 1 })], [recorded()])[0].status).toBe('import');
    expect(markRecorded([row({ valueDate: '2026-03-09' })], [recorded()])[0].status).toBe('import');
  });

  it('never matches an operation typed by hand on a label of the file', () => {
    expect(markRecorded([row()], [recorded({ sourceLabel: null })])[0].status).toBe('import');
  });

  it('matches on the third party as well as on the label of the file', () => {
    expect(
      markRecorded([row()], [recorded({ thirdParty: 'carrefour', sourceLabel: null })])[0].status,
    ).toBe('skipped');
  });

  it('lets an operation absorb one row only, whichever way it matches', () => {
    const rows = [row({ line: 1 }), row({ line: 2 })];
    expect(markRecorded(rows, [recorded()]).map((r) => r.status)).toEqual(['skipped', 'import']);
  });

  it('does not match an empty label of the file', () => {
    expect(
      markRecorded([row({ sourceLabel: '' })], [recorded({ sourceLabel: '' })])[0].status,
    ).toBe('import');
  });
});

describe('markRecorded explains a skipped row', () => {
  const imported = readRows([ofxRow({ name: 'Bakery', reference: 'R1', date: '20260305' })]);

  it('names the operation matched by the bank reference', () => {
    const [row] = markRecorded(imported, [
      {
        id: 'op-9',
        reconciled: true,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        valueDate: '2026-02-20',
        debit: 10000,
        credit: null,
        thirdParty: 'Old name',
        sourceLabel: null,
        bankReference: 'R1',
      },
    ]) as ReadyRow[];
    expect(row.status).toBe('skipped');
    expect(row.recorded).toEqual({
      operationId: 'op-9',
      valueDate: '2026-02-20',
      thirdParty: 'Old name',
      reconciled: true,
      matchedBy: 'reference',
    });
  });

  it('names the operation matched by its details, as stored', () => {
    const [row] = markRecorded(imported, [
      {
        id: 'op-7',
        reconciled: false,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        valueDate: '2026-03-05',
        debit: 10000,
        credit: null,
        thirdParty: ' BAKERY',
        sourceLabel: null,
        bankReference: null,
      },
    ]) as ReadyRow[];
    expect(row.recorded).toEqual({
      operationId: 'op-7',
      valueDate: '2026-03-05',
      thirdParty: ' BAKERY',
      reconciled: false,
      matchedBy: 'details',
    });
  });

  it('adds nothing to a row that stays to import', () => {
    expect((markRecorded(imported, []) as ReadyRow[])[0].recorded).toBeNull();
  });
});

describe('markRecorded recognises the other side of a transfer', () => {
  const transferRow = (overrides: Partial<OfxRow> = {}) =>
    readRows([
      ofxRow({
        date: '20260305',
        amount: '-100',
        type: 'XFER',
        name: 'VIR M DUPONT',
        ...overrides,
      }),
    ]);
  const mirror = (overrides: Partial<RecordedOperation> = {}): RecordedOperation => ({
    id: 'op-mirror',
    reconciled: false,
    paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
    valueDate: '2026-03-05',
    debit: 1000000,
    credit: null,
    thirdParty: 'Livret A',
    sourceLabel: null,
    bankReference: null,
    ...overrides,
  });
  const matched = (rows: RowOutcome[], recorded: RecordedOperation[]) =>
    markRecorded(rows, recorded)[0] as ReadyRow;

  it('skips a transfer row whose side is recorded, whatever the third party', () => {
    const row = matched(transferRow(), [mirror()]);

    expect(row.status).toBe('skipped');
    expect(row.recorded).toEqual({
      operationId: 'op-mirror',
      valueDate: '2026-03-05',
      thirdParty: 'Livret A',
      reconciled: false,
      matchedBy: 'transfer',
    });
  });

  it.each([-3, -1, 0, 2, 3])('accepts a date %d days away', (days) => {
    const date = shiftDays('2026-03-05', days);
    expect(matched(transferRow(), [mirror({ valueDate: date })]).status).toBe('skipped');
  });

  it.each([-4, 4, 30])('refuses a date %d days away', (days) => {
    const date = shiftDays('2026-03-05', days);
    expect(matched(transferRow(), [mirror({ valueDate: date })]).status).toBe('import');
  });

  it('prefers the closest date', () => {
    const row = matched(transferRow(), [
      mirror({ id: 'far', valueDate: '2026-03-08' }),
      mirror({ id: 'near', valueDate: '2026-03-06' }),
    ]);
    expect(row.recorded?.operationId).toBe('near');
  });

  it.each([
    ['another amount', mirror({ debit: 1000001 })],
    [
      'the other side',
      mirror({ debit: null, credit: 1000000, paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_CREDIT }),
    ],
    ['a method that is not a transfer', mirror({ paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD })],
    ['a label of a file', mirror({ sourceLabel: 'VIR SOMETHING' })],
    ['a bank reference', mirror({ bankReference: 'R-1' })],
  ])('does not take an operation with %s', (_name, recorded) => {
    expect(matched(transferRow(), [recorded]).status).toBe('import');
  });

  it('does not apply to a row that is not a transfer', () => {
    const card = readRows([ofxRow({ date: '20260305', amount: '-100', type: 'POS' })]);
    expect(matched(card, [mirror()]).status).toBe('import');
  });

  it('leaves the exact match to its own rule', () => {
    const row = matched(transferRow({ name: 'Livret A' }), [mirror()]);
    expect(row.recorded?.matchedBy).toBe('details');
  });

  it('matches each operation once', () => {
    const rows = readRows([
      ofxRow({ date: '20260305', amount: '-100', type: 'XFER', name: 'A' }),
      ofxRow({ date: '20260305', amount: '-100', type: 'XFER', name: 'B' }),
    ]);
    expect(markRecorded(rows, [mirror()]).map((row) => row.status)).toEqual(['skipped', 'import']);
  });

  it('adds nothing for a row an operation matches by its bank reference first', () => {
    const rows = transferRow({ reference: 'R-9' });
    const other = mirror({ id: 'op-ref', bankReference: 'R-9', valueDate: '2026-03-20' });
    const row = matched(rows, [mirror(), other]);
    expect(row.recorded?.operationId).toBe('op-ref');
  });
});

describe('recordedWindows', () => {
  it('gives the days within the tolerance of each date', () => {
    expect(recordedWindows(['2026-03-10'])).toEqual([{ from: '2026-03-07', to: '2026-03-13' }]);
  });

  it('joins the windows that overlap or touch, and keeps the others apart', () => {
    expect(
      recordedWindows(['2026-03-10', '2026-03-15', '2026-03-17', '2026-09-01', '2026-03-10']),
    ).toEqual([
      { from: '2026-03-07', to: '2026-03-20' },
      { from: '2026-08-29', to: '2026-09-04' },
    ]);
  });

  it('is empty without dates', () => {
    expect(recordedWindows([])).toEqual([]);
  });
});

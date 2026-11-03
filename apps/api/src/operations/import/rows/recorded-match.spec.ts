import {
  PAYMENT_METHOD_ID,
  TRANSFER_PAYMENT_METHOD_IDS,
  type EntryType,
} from '@bagheera/reference-data';
import type { OfxRow } from '../ofx';
import { normalizeLabel } from './labels';
import { readRows } from './read-rows';
import { type ReadyRow, type RecordedMatch, type RowOutcome } from './types';
import {
  DETAILS_DATE_TOLERANCE_DAYS,
  REFERENCE_DATE_TOLERANCE_DAYS,
  TRANSFER_DATE_TOLERANCE_DAYS,
  dayNumber,
  shiftDays,
  markRecorded,
  type RecordedOperation,
  recordedWindows,
} from './recorded-match';

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

// The matching written the plain way, one scan of the candidates per row: what
// the indexed one must answer exactly.
function naiveMarkRecorded(rows: RowOutcome[], recorded: RecordedOperation[]): RowOutcome[] {
  interface Naive {
    thirdParty: string;
    source: string | null;
    type: EntryType;
    amount: number;
    date: number;
    used: boolean;
    typed: boolean;
    otherSide: { type: EntryType; amount: number; date: number } | null;
    recorded: Omit<RecordedMatch, 'matchedBy'>;
  }
  const push = (map: Map<string, Naive[]>, key: string, candidate: Naive) =>
    map.set(key, [...(map.get(key) ?? []), candidate]);
  const groupKey = (valueDate: string, type: EntryType, amount: number) =>
    `${valueDate}|${type}|${amount}`;
  const groups = new Map<string, Naive[]>();
  const byReference = new Map<string, Naive[]>();
  const typedByAmount = new Map<string, Naive[]>();
  for (const operation of recorded) {
    const type: EntryType = operation.debit === null ? 'credit' : 'debit';
    const amount = (operation.debit ?? operation.credit) as number;
    const date = dayNumber(operation.valueDate);
    const candidate: Naive = {
      thirdParty: normalizeLabel(operation.thirdParty),
      source: operation.sourceLabel === null ? null : normalizeLabel(operation.sourceLabel),
      type,
      amount,
      date,
      used: false,
      typed: !operation.reconciled && operation.bankReference === null,
      otherSide:
        TRANSFER_PAYMENT_METHOD_IDS.includes(operation.paymentMethodId) &&
        operation.bankReference === null &&
        operation.sourceLabel === null
          ? { type, amount, date }
          : null,
      recorded: {
        operationId: operation.id,
        valueDate: operation.valueDate,
        thirdParty: operation.thirdParty,
        reconciled: operation.reconciled,
      },
    };
    push(groups, groupKey(operation.valueDate, type, amount), candidate);
    if (candidate.typed) push(typedByAmount, `${type}|${amount}`, candidate);
    if (operation.bankReference !== null) push(byReference, operation.bankReference, candidate);
  }
  const skipped = new Map<number, RecordedMatch>();
  const take = (
    candidate: Naive | undefined,
    line: number,
    matchedBy: RecordedMatch['matchedBy'],
  ) => {
    if (!candidate) return;
    candidate.used = true;
    skipped.set(line, { ...candidate.recorded, matchedBy });
  };
  for (const row of rows) {
    if (row.status !== 'import' || row.bankReference === null) continue;
    const date = dayNumber(row.valueDate);
    take(
      byReference
        .get(row.bankReference)
        ?.find(
          (candidate) =>
            !candidate.used &&
            candidate.type === row.type &&
            candidate.amount === row.amount &&
            Math.abs(candidate.date - date) <= REFERENCE_DATE_TOLERANCE_DAYS,
        ),
      row.line,
      'reference',
    );
  }
  for (const row of rows) {
    if (row.status !== 'import' || skipped.has(row.line)) continue;
    const group = groups.get(groupKey(row.valueDate, row.type, row.amount));
    if (!group) continue;
    const thirdParty = normalizeLabel(row.thirdParty);
    const source = normalizeLabel(row.sourceLabel);
    take(
      group.find((candidate) => !candidate.used && candidate.thirdParty === thirdParty) ??
        group.find((candidate) => !candidate.used && source !== '' && candidate.source === source),
      row.line,
      'details',
    );
  }
  for (const row of rows) {
    if (row.status !== 'import' || skipped.has(row.line)) continue;
    const date = dayNumber(row.valueDate);
    const thirdParty = normalizeLabel(row.thirdParty);
    const source = normalizeLabel(row.sourceLabel);
    let closest: { candidate: Naive; gap: number } | undefined;
    for (const candidate of typedByAmount.get(`${row.type}|${row.amount}`) ?? []) {
      const gap = Math.abs(candidate.date - date);
      const sameLabel =
        candidate.thirdParty === thirdParty || (source !== '' && candidate.source === source);
      if (candidate.used || !sameLabel || gap > DETAILS_DATE_TOLERANCE_DAYS) continue;
      if (!closest || gap < closest.gap) closest = { candidate, gap };
    }
    take(closest?.candidate, row.line, 'details');
  }
  const otherSides = new Map<string, Naive[]>();
  for (const candidate of [...groups.values()].flat()) {
    if (!candidate.otherSide) continue;
    push(otherSides, `${candidate.otherSide.type}|${candidate.otherSide.amount}`, candidate);
  }
  for (const row of rows) {
    if (
      row.status !== 'import' ||
      skipped.has(row.line) ||
      !TRANSFER_PAYMENT_METHOD_IDS.includes(row.paymentMethodId)
    ) {
      continue;
    }
    const date = dayNumber(row.valueDate);
    let best: { candidate: Naive; gap: number } | undefined;
    for (const candidate of otherSides.get(`${row.type}|${row.amount}`) ?? []) {
      const side = candidate.otherSide;
      if (candidate.used || !side) continue;
      const gap = Math.abs(side.date - date);
      if (gap <= TRANSFER_DATE_TOLERANCE_DAYS && (!best || gap < best.gap)) {
        best = { candidate, gap };
      }
    }
    take(best?.candidate, row.line, 'transfer');
  }
  return rows.map((row): RowOutcome => {
    const match = skipped.get(row.line);
    return row.status === 'import' && match ? { ...row, status: 'skipped', recorded: match } : row;
  });
}

describe('markRecorded against the plain matching', () => {
  // A seeded generator, so that a failure can be replayed.
  function generator(seed: number) {
    let state = seed >>> 0;
    const next = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)];
    return { next, pick };
  }

  const METHODS = [
    PAYMENT_METHOD_ID.CREDIT_CARD,
    PAYMENT_METHOD_ID.TRANSFER_DEBIT,
    PAYMENT_METHOD_ID.TRANSFER_CREDIT,
  ];
  // Few values, the same texts as third parties and labels of files, so that
  // keys, labels and references collide often.
  const LABELS = ['a', 'b', ' A', 'c', ''];

  function scenario(seed: number) {
    const { next, pick } = generator(seed);
    const day = () =>
      shiftDays(
        '2026-03-05',
        next() < 0.1 ? pick([-40, -31, -20, 31, 32]) : pick([-6, -4, -3, -2, -1, 0, 1, 2, 3, 4, 6]),
      );
    const type = (): EntryType => (next() < 0.7 ? 'debit' : 'credit');
    const amount = () => pick([100, 200]);
    const reference = () => (next() < 0.6 ? null : pick(['R1', 'R2']));
    const recorded: RecordedOperation[] = [];
    for (let i = 0, count = Math.floor(next() * 16); i < count; i += 1) {
      if (recorded.length > 0 && next() < 0.15) {
        recorded.push({ ...pick(recorded), id: `op-${i}` });
        continue;
      }
      const side = type();
      recorded.push({
        id: `op-${i}`,
        reconciled: next() < 0.3,
        paymentMethodId: pick(METHODS),
        valueDate: day(),
        debit: side === 'debit' ? amount() : null,
        credit: side === 'credit' ? amount() : null,
        thirdParty: pick(LABELS),
        sourceLabel: next() < 0.4 ? null : pick(LABELS),
        bankReference: reference(),
      });
    }
    const rows: RowOutcome[] = [];
    for (let line = 1, count = Math.floor(next() * 13); line <= count; line += 1) {
      if (next() < 0.05) {
        rows.push({ status: 'invalid', line, reason: 'date_invalid', sourceLabel: null });
        continue;
      }
      rows.push({
        status: next() < 0.05 ? 'skipped' : 'import',
        line,
        valueDate: day(),
        type: type(),
        amount: amount(),
        thirdParty: pick(LABELS),
        notes: '',
        paymentMethodId: pick(METHODS),
        paymentMethodOrigin: null,
        categoryId: null,
        categoryOrigin: null,
        transferAccountId: null,
        transferAccountOrigin: null,
        sourceLabel: pick(LABELS),
        labelOrigin: 'file',
        bankReference: reference(),
        recorded: null,
      });
    }
    return { rows, recorded };
  }

  it('answers the same on thousands of drawn files and accounts', () => {
    let skipped = 0;
    for (let seed = 1; seed <= 5000; seed += 1) {
      const { rows, recorded } = scenario(seed);
      const expected = naiveMarkRecorded(rows, recorded);
      expect(markRecorded(rows, recorded), `seed ${seed}`).toEqual(expected);
      skipped += expected.filter((row) => row.status === 'skipped').length;
    }
    // The draws must exercise the matching, not only leave rows to import.
    expect(skipped).toBeGreaterThan(5000);
  });

  it('keeps an operation found by its label of the file once others took the third party', () => {
    const base = {
      reconciled: false,
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      valueDate: '2026-03-05',
      debit: 100,
      credit: null,
      bankReference: null,
    };
    const recorded: RecordedOperation[] = [
      { ...base, id: 'op-1', thirdParty: 'x', sourceLabel: null },
      { ...base, id: 'op-2', thirdParty: 'x', sourceLabel: null },
      { ...base, id: 'op-3', thirdParty: 'other', sourceLabel: 'x' },
    ];
    const row = (line: number, thirdParty: string, sourceLabel: string): RowOutcome => ({
      status: 'import',
      line,
      valueDate: '2026-03-05',
      type: 'debit',
      amount: 100,
      thirdParty,
      notes: '',
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      paymentMethodOrigin: null,
      categoryId: null,
      categoryOrigin: null,
      transferAccountId: null,
      transferAccountOrigin: null,
      sourceLabel,
      labelOrigin: 'file',
      bankReference: null,
      recorded: null,
    });
    const rows = [row(1, 'x', 'x'), row(2, 'x', 'x'), row(3, 'q', 'x')];
    const marked = markRecorded(rows, recorded);
    expect(marked.map((r) => (r.status === 'skipped' ? r.recorded?.operationId : null))).toEqual([
      'op-1',
      'op-2',
      'op-3',
    ]);
    expect(marked).toEqual(naiveMarkRecorded(rows, recorded));
  });

  it('stays quick on an account holding many operations alike', () => {
    const recorded: RecordedOperation[] = Array.from({ length: 40_000 }, (_, i) => ({
      id: `op-${String(i).padStart(5, '0')}`,
      reconciled: i % 3 === 0,
      paymentMethodId:
        i % 5 === 0 ? PAYMENT_METHOD_ID.TRANSFER_DEBIT : PAYMENT_METHOD_ID.CREDIT_CARD,
      valueDate: '2026-03-05',
      debit: 100,
      credit: null,
      thirdParty: `Label ${i}`,
      sourceLabel: i % 2 === 0 ? `SOURCE ${i}` : null,
      bankReference: i % 7 === 0 ? `R${i % 50}` : null,
    }));
    const rows: RowOutcome[] = Array.from({ length: 5_000 }, (_, i) => ({
      status: 'import',
      line: i + 1,
      valueDate: shiftDays('2026-03-05', (i % 5) - 2),
      type: 'debit',
      amount: 100,
      thirdParty: i % 2 === 0 ? `Label ${i * 7}` : `Unknown ${i}`,
      notes: '',
      paymentMethodId:
        i % 4 === 0 ? PAYMENT_METHOD_ID.TRANSFER_DEBIT : PAYMENT_METHOD_ID.CREDIT_CARD,
      paymentMethodOrigin: null,
      categoryId: null,
      categoryOrigin: null,
      transferAccountId: null,
      transferAccountOrigin: null,
      sourceLabel: i % 3 === 0 ? `SOURCE ${i * 4}` : `NOWHERE ${i}`,
      labelOrigin: 'file',
      bankReference: i % 6 === 0 ? `R${i % 50}` : null,
      recorded: null,
    }));
    const started = performance.now();
    const marked = markRecorded(rows, recorded);
    const elapsed = performance.now() - started;
    expect(marked.filter((row) => row.status === 'skipped').length).toBeGreaterThan(1000);
    expect(elapsed).toBeLessThan(1500);
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

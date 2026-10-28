import type { OfxRow } from '../ofx';
import { readRows } from './read-rows';
import {
  cleanLabel,
  labelKey,
  planLabelIntents,
  rememberedLabels,
  type LabelRules,
} from './labels';

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

describe('cleanLabel', () => {
  it.each([
    ['LA BOULANGERIE 05/03 12,50EUR', 'LA BOULANGERIE'],
    ['LA BOULANGERIE 05/03/26 12.50 EUR', 'LA BOULANGERIE'],
    ['LECLERC 05-03-2026 1 234,56', 'LECLERC 1'],
    ['PURCHASE TESCO 2026-03-05 14:32 £12.50', 'PURCHASE TESCO'],
    ['EDF 05.03', 'EDF'],
    ['F COTISATION EUROCOMPTE 10/26', 'F COTISATION EUROCOMPTE'],
    ['COTISATION CARTE 10/2026', 'COTISATION CARTE'],
    ['ABONNEMENT 2026-10', 'ABONNEMENT'],
    ['ABONNEMENT 2026-10-05', 'ABONNEMENT'],
    ['EDF ENERGIE', 'EDF ENERGIE'],
    ['M DUPONT REF 2026000123', 'M DUPONT REF 2026000123'],
    ['  AMAZON  12,5  ', 'AMAZON'],
  ])('turns %s into %s', (label, expected) => {
    expect(cleanLabel(label)).toBe(expected);
  });

  it.each([
    ['PAIEMENT CB 0503 BOULANGERIE', 'BOULANGERIE'],
    ['PAIEMENT CB BOULANGERIE', 'BOULANGERIE'],
    ['PAIEMENT PAR CARTE X1234 LECLERC', 'LECLERC'],
    ['ACHAT CB*4711 BOULANGERIE 05/03', 'BOULANGERIE'],
    ['CB*4711 BOULANGERIE', 'BOULANGERIE'],
    ['CARD PURCHASE TESCO', 'TESCO'],
    ['PRLV SEPA EDF', 'EDF'],
    ['PRÉLÈVEMENT SEPA FREE MOBILE', 'FREE MOBILE'],
    ['DIRECT DEBIT NETFLIX', 'NETFLIX'],
    ['VIR SEPA INST M DUPONT', 'M DUPONT'],
    ['VIREMENT PERMANENT LOYER', 'LOYER'],
    ['VERS LIVRET A', 'LIVRET A'],
    ['RETRAIT DAB PARIS 15', 'PARIS 15'],
    ['ATM WITHDRAWAL LONDON', 'LONDON'],
    ['CHQ 0001234', '0001234'],
    ['CHEQUES 12', '12'],
    ['VERSEMENT ESPECES', 'ESPECES'],
    ['PAIEMENT CB PRLV SEPA EDF', 'EDF'],
  ])('leaves the payment-method wording out of %s', (label, expected) => {
    expect(cleanLabel(label)).toBe(expected);
  });

  it('leaves a payment-method word out only at the start', () => {
    expect(cleanLabel('AMAZON CB')).toBe('AMAZON CB');
    expect(cleanLabel('EDF PRLV SEPA')).toBe('EDF PRLV SEPA');
  });

  it('does not take a word that merely starts like a keyword', () => {
    expect(cleanLabel('VIRGIN ACTIVE')).toBe('VIRGIN ACTIVE');
    expect(cleanLabel('CARTOUCHE ENCRE')).toBe('CARTOUCHE ENCRE');
    expect(cleanLabel('PAIEMENT LOYER')).toBe('PAIEMENT LOYER');
  });

  it('keeps the label when nothing else would be left', () => {
    expect(cleanLabel(' 05/03 12,50 ')).toBe('05/03 12,50');
    expect(cleanLabel('PAIEMENT CB')).toBe('PAIEMENT CB');
    expect(cleanLabel('PRLV SEPA 05/03')).toBe('PRLV SEPA');
    expect(cleanLabel('')).toBe('');
  });

  it('does not take a letter-glued number for a date or an amount', () => {
    expect(cleanLabel('REF12,50')).toBe('REF12,50');
    expect(cleanLabel('A05/03B')).toBe('A05/03B');
  });

  it('stays quick on long labels', () => {
    const started = Date.now();
    cleanLabel('1'.repeat(4096));
    cleanLabel('1,'.repeat(2048));
    cleanLabel('1/'.repeat(2048));
    cleanLabel('CB '.repeat(2048));
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('compares labels ignoring case, spaces, dates, amounts and payment wording', () => {
    expect(labelKey(' la boulangerie 05/03 12,50EUR')).toBe(
      labelKey('LA BOULANGERIE 06/03 8,10EUR'),
    );
    expect(labelKey('PAIEMENT CB EDF')).toBe(labelKey('PRLV SEPA edf'));
    expect(labelKey('LA BOULANGERIE')).not.toBe(labelKey('LA BOUCHERIE'));
  });
});

describe('label rules', () => {
  const labels = (rules: Partial<LabelRules>) => ({
    corrections: new Map<string, string>(),
    changes: new Map<number, string>(),
    ...rules,
  });
  const read = (label: string, rules: Partial<LabelRules>, line = 1) => {
    const source = Array.from({ length: line }, (_, i) =>
      ofxRow({ name: i + 1 === line ? label : 'Other' }),
    );
    return readRows(source, labels(rules))[line - 1];
  };

  it('replaces the label of a row by a remembered correction, ignoring case', () => {
    const row = read('CARREFOUR MARKET', {
      corrections: new Map([['carrefour market', 'Carrefour']]),
    });
    expect(row).toMatchObject({
      status: 'import',
      thirdParty: 'Carrefour',
      notes: '',
      sourceLabel: 'CARREFOUR MARKET',
      labelOrigin: 'correction',
    });
  });

  it('applies a correction to a row whose label differs only by a date or an amount', () => {
    const corrections = new Map([['la boulangerie', 'Bakery']]);
    for (const label of ['LA BOULANGERIE 05/03 12,50EUR', 'LA BOULANGERIE 17/04 3.10']) {
      expect(read(label, { corrections })).toMatchObject({
        thirdParty: 'Bakery',
        sourceLabel: label,
        labelOrigin: 'correction',
      });
    }
  });

  it('reads a correction as typed: no notes, even when the label of the file was long', () => {
    const long = 'PRLV SEPA '.repeat(10);
    const row = read(long, { corrections: new Map([[long.trim().toLowerCase(), 'EDF']]) });
    expect(row).toMatchObject({ thirdParty: 'EDF', notes: '', labelOrigin: 'correction' });
  });

  it('applies a change of this preview in place of a correction', () => {
    const row = read('EDF ENERGIE', {
      corrections: new Map([['edf energie', 'EDF']]),
      changes: new Map([[1, ' Electricity ']]),
    });
    expect(row).toMatchObject({
      thirdParty: 'Electricity',
      sourceLabel: 'EDF ENERGIE',
      labelOrigin: 'change',
    });
  });

  it('drops the correction when a row is changed back to the label of the file', () => {
    const row = read('EDF ENERGIE', {
      corrections: new Map([['edf energie', 'EDF']]),
      changes: new Map([[1, 'EDF ENERGIE']]),
    });
    expect(row).toMatchObject({ thirdParty: 'EDF ENERGIE', labelOrigin: 'file' });
  });

  it('drops the correction when a row is changed back to its third party without the date', () => {
    const row = read('EDF ENERGIE 05/03', {
      corrections: new Map([['edf energie', 'EDF']]),
      changes: new Map([[1, 'EDF ENERGIE']]),
    });
    expect(row).toMatchObject({ thirdParty: 'EDF ENERGIE', labelOrigin: 'file' });
  });

  it('holds a change to the rules of a third party', () => {
    expect(read('x', { changes: new Map([[1, '  ']]) })).toMatchObject({
      status: 'invalid',
      reason: 'third_party_missing',
      sourceLabel: 'x',
    });
    expect(read('x', { changes: new Map([[1, 'y'.repeat(65)]]) })).toMatchObject({
      status: 'invalid',
      reason: 'third_party_too_long',
    });
  });

  it('lets a change fix a label the file made invalid', () => {
    expect(read('', {})).toMatchObject({ status: 'invalid', reason: 'third_party_missing' });
    expect(read('', { changes: new Map([[1, 'Bakery']]) })).toMatchObject({
      status: 'import',
      thirdParty: 'Bakery',
    });
    expect(read('x'.repeat(4097), { changes: new Map([[1, 'Bakery']]) })).toMatchObject({
      status: 'import',
      thirdParty: 'Bakery',
      sourceLabel: 'x'.repeat(4096),
    });
  });

  it('ignores a change for another line', () => {
    expect(read('Bakery', { changes: new Map([[2, 'Butcher']]) })).toMatchObject({
      thirdParty: 'Bakery',
    });
  });
});

describe('rememberedLabels', () => {
  const source = [
    ofxRow({ name: 'EDF ENERGIE' }),
    ofxRow({ name: 'cb carrefour' }),
    ofxRow({ name: '' }),
  ];
  const change = (line: number, thirdParty: string, remember = true) => ({
    line,
    thirdParty,
    remember,
  });

  it('keeps the changes the Member chose to remember', () => {
    expect(rememberedLabels(source, [change(1, 'EDF'), change(2, 'Carrefour', false)])).toEqual([
      { sourceLabel: 'EDF ENERGIE', thirdParty: 'EDF' },
    ]);
  });

  it('remembers the label without its date and amount', () => {
    const dated = [ofxRow({ name: 'LA BOULANGERIE 05/03 12,50EUR' })];
    expect(rememberedLabels(dated, [change(1, 'Bakery')])).toEqual([
      { sourceLabel: 'LA BOULANGERIE', thirdParty: 'Bakery' },
    ]);
    expect(rememberedLabels(dated, [change(1, 'LA BOULANGERIE 05/03 12,50EUR')])).toEqual([
      { sourceLabel: 'LA BOULANGERIE', thirdParty: null },
    ]);
  });

  it('keeps one change for rows whose labels differ only by a date', () => {
    const dated = [ofxRow({ name: 'THE BAKERY 05/03' }), ofxRow({ name: 'THE BAKERY 06/03' })];
    expect(rememberedLabels(dated, [change(1, 'A'), change(2, 'B')])).toEqual([
      { sourceLabel: 'THE BAKERY', thirdParty: 'B' },
    ]);
  });

  it('removes the correction of a label changed back to its third party without the date', () => {
    const dated = [ofxRow({ name: 'LA BOULANGERIE 05/03 12,50EUR' })];
    expect(rememberedLabels(dated, [change(1, 'LA BOULANGERIE')])).toEqual([
      { sourceLabel: 'LA BOULANGERIE', thirdParty: null },
    ]);
  });

  it('removes the correction of a label changed back to the label of the file', () => {
    expect(rememberedLabels(source, [change(1, ' EDF ENERGIE ')])).toEqual([
      { sourceLabel: 'EDF ENERGIE', thirdParty: null },
    ]);
  });

  it('uses the memo as the label of the file when the name is empty', () => {
    expect(
      rememberedLabels([ofxRow({ name: '', memo: 'SFR MOBILE' })], [change(1, 'SFR')]),
    ).toEqual([{ sourceLabel: 'SFR MOBILE', thirdParty: 'SFR' }]);
  });

  it('skips an empty or over-long label of the file, and a change that is not a third party', () => {
    const long = [ofxRow({ name: 'x'.repeat(513) }), ofxRow({ name: 'x'.repeat(512) })];
    expect(rememberedLabels(long, [change(1, 'Bakery')])).toEqual([]);
    expect(rememberedLabels(long, [change(2, 'Bakery')])).toHaveLength(1);
    expect(rememberedLabels(source, [change(3, 'Bakery')])).toEqual([]);
    expect(rememberedLabels(source, [change(1, ' '), change(2, 'y'.repeat(65))])).toEqual([]);
  });

  it('ignores a line the file does not have', () => {
    expect(rememberedLabels(source, [change(9, 'Bakery')])).toEqual([]);
  });

  it('keeps the last change when rows share a label of the file, ignoring case', () => {
    const shared = [ofxRow({ name: 'EDF ENERGIE' }), ofxRow({ name: 'edf energie' })];
    expect(rememberedLabels(shared, [change(2, 'Power'), change(1, 'EDF')])).toEqual([
      { sourceLabel: 'edf energie', thirdParty: 'Power' },
    ]);
  });
});

describe('planLabelIntents', () => {
  const remembered = (id: string, sourceLabel: string, thirdParty: string) => ({
    id,
    sourceLabel,
    thirdParty,
  });

  it('does nothing when there is nothing to remember or forget', () => {
    expect(planLabelIntents([remembered('1', 'BAKERY', 'Bakery')], [], 10)).toEqual({
      deletes: [],
      updates: [],
      inserts: [],
      notRemembered: 0,
    });
  });

  it('remembers a label that has no correction yet', () => {
    const intent = { sourceLabel: 'BAKERY', thirdParty: 'Bakery' };

    expect(planLabelIntents([], [intent], 10)).toMatchObject({ inserts: [intent], updates: [] });
  });

  it('replaces the third party of a correction that differs', () => {
    expect(
      planLabelIntents(
        [remembered('1', 'BAKERY', 'Bakery')],
        [{ sourceLabel: 'BAKERY', thirdParty: 'Boulangerie' }],
        10,
      ),
    ).toMatchObject({ updates: [{ id: '1', thirdParty: 'Boulangerie' }], inserts: [] });
  });

  it('leaves a correction that already says the same', () => {
    expect(
      planLabelIntents(
        [remembered('1', 'BAKERY', 'Bakery')],
        [{ sourceLabel: 'BAKERY', thirdParty: 'Bakery' }],
        10,
      ),
    ).toEqual({ deletes: [], updates: [], inserts: [], notRemembered: 0 });
  });

  it('matches labels the way corrections are looked up', () => {
    expect(
      planLabelIntents(
        [remembered('1', 'Bakery', 'Bakery')],
        [{ sourceLabel: '  BAKERY 12/03', thirdParty: 'Boulangerie' }],
        10,
      ),
    ).toMatchObject({ updates: [{ id: '1', thirdParty: 'Boulangerie' }], inserts: [] });
  });

  it('forgets the correction of a label whose third party is null', () => {
    expect(
      planLabelIntents(
        [remembered('1', 'BAKERY', 'Bakery')],
        [{ sourceLabel: 'BAKERY', thirdParty: null }],
        10,
      ),
    ).toMatchObject({ deletes: ['1'] });
  });

  it('has nothing to forget for a label with no correction', () => {
    expect(planLabelIntents([], [{ sourceLabel: 'BAKERY', thirdParty: null }], 10)).toEqual({
      deletes: [],
      updates: [],
      inserts: [],
      notRemembered: 0,
    });
  });

  it('leaves out the new corrections that do not fit under the quota', () => {
    const plan = planLabelIntents(
      [remembered('1', 'A', 'a')],
      [
        { sourceLabel: 'B', thirdParty: 'b' },
        { sourceLabel: 'C', thirdParty: 'c' },
        { sourceLabel: 'D', thirdParty: 'd' },
      ],
      3,
    );

    expect(plan.inserts).toEqual([
      { sourceLabel: 'B', thirdParty: 'b' },
      { sourceLabel: 'C', thirdParty: 'c' },
    ]);
    expect(plan.notRemembered).toBe(1);
  });

  it('leaves out every new correction when the Member is at the quota', () => {
    const plan = planLabelIntents(
      [remembered('1', 'A', 'a'), remembered('2', 'B', 'b')],
      [{ sourceLabel: 'C', thirdParty: 'c' }],
      2,
    );

    expect(plan).toMatchObject({ inserts: [], notRemembered: 1 });
  });

  it('counts the corrections forgotten in the same import as room', () => {
    const plan = planLabelIntents(
      [remembered('1', 'A', 'a'), remembered('2', 'B', 'b')],
      [
        { sourceLabel: 'A', thirdParty: null },
        { sourceLabel: 'C', thirdParty: 'c' },
      ],
      2,
    );

    expect(plan).toMatchObject({
      deletes: ['1'],
      inserts: [{ sourceLabel: 'C', thirdParty: 'c' }],
      notRemembered: 0,
    });
  });

  it('never has negative room when the Member is already over the quota', () => {
    const plan = planLabelIntents(
      [remembered('1', 'A', 'a'), remembered('2', 'B', 'b')],
      [{ sourceLabel: 'C', thirdParty: 'c' }],
      1,
    );

    expect(plan).toMatchObject({ inserts: [], notRemembered: 1 });
  });
});

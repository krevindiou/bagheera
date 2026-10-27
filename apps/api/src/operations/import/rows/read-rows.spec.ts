import { FIELD_LIMITS, PAYMENT_METHOD_ID } from '@bagheera/reference-data';
import type { OfxRow } from '../ofx';
import { NO_LABEL_RULES } from './labels';
import { type ReadyRow } from './types';
import { readRows } from './read-rows';

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

describe('readRows', () => {
  it('reads the sign as the type, with the default payment method of that type', () => {
    const rows = readRows([
      ofxRow({ date: '20260305', amount: '-12.50', name: 'Bakery', reference: 'A1' }),
      ofxRow({ date: '20260306', amount: '1000', name: 'Employer' }),
    ]);
    expect(rows).toEqual([
      {
        status: 'import',
        line: 1,
        valueDate: '2026-03-05',
        type: 'debit',
        amount: 125000,
        thirdParty: 'Bakery',
        notes: '',
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        paymentMethodOrigin: 'default',
        categoryId: null,
        categoryOrigin: null,
        transferAccountId: null,
        transferAccountOrigin: null,
        sourceLabel: 'Bakery',
        labelOrigin: 'file',
        bankReference: 'A1',
        recorded: null,
      },
      {
        status: 'import',
        line: 2,
        valueDate: '2026-03-06',
        type: 'credit',
        amount: 10000000,
        thirdParty: 'Employer',
        notes: '',
        paymentMethodId: PAYMENT_METHOD_ID.DEPOSIT,
        paymentMethodOrigin: 'default',
        categoryId: null,
        categoryOrigin: null,
        transferAccountId: null,
        transferAccountOrigin: null,
        sourceLabel: 'Employer',
        labelOrigin: 'file',
        bankReference: null,
        recorded: null,
      },
    ]);
  });

  it('takes the memo when the name is empty', () => {
    const [row] = readRows([ofxRow({ name: '', memo: 'EDF ENERGIE' })]);
    expect(row).toMatchObject({ thirdParty: 'EDF ENERGIE', sourceLabel: 'EDF ENERGIE', notes: '' });
  });

  it('keeps the memo in the notes when the name is the label', () => {
    const [row] = readRows([ofxRow({ name: 'CB', memo: 'CARREFOUR PARIS' })]);
    expect(row).toMatchObject({ thirdParty: 'CB', sourceLabel: 'CB', notes: 'CARREFOUR PARIS' });
  });

  it('puts the memo after the full label when the third party is cut from it', () => {
    const name = 'A'.repeat(70);
    const [row] = readRows([ofxRow({ name, memo: 'detail' })]);
    expect(row).toMatchObject({ notes: `${name}\ndetail` });
  });

  it('does not repeat a memo equal to the name, and cuts the notes at their cap', () => {
    const [same] = readRows([ofxRow({ name: 'EDF', memo: 'EDF' })]);
    expect(same).toMatchObject({ notes: '' });
    const [long] = readRows([ofxRow({ name: 'EDF', memo: 'm'.repeat(FIELD_LIMITS.NOTES + 10) })]);
    expect((long as ReadyRow).notes).toHaveLength(FIELD_LIMITS.NOTES);
  });

  it('cuts a label over 64 characters and keeps the whole label in the notes', () => {
    const [row] = readRows([ofxRow({ name: 'é'.repeat(70) })]);
    expect(row).toMatchObject({
      status: 'import',
      thirdParty: 'é'.repeat(64),
      notes: 'é'.repeat(70),
    });
  });

  it('counts characters, not UTF-16 units, when cutting a label', () => {
    const [row] = readRows([ofxRow({ name: '😀'.repeat(65) })]);
    expect(row).toMatchObject({ thirdParty: '😀'.repeat(64), notes: '😀'.repeat(65) });
  });

  it('refuses a label over 4,096 characters and an empty one', () => {
    const rows = readRows([ofxRow({ name: 'x'.repeat(4097) }), ofxRow({ name: '', memo: '' })]);
    expect(rows).toEqual([
      {
        status: 'invalid',
        line: 1,
        reason: 'third_party_too_long',
        sourceLabel: 'x'.repeat(4096),
      },
      { status: 'invalid', line: 2, reason: 'third_party_missing', sourceLabel: '' },
    ]);
  });

  it('names the first reason a row is invalid', () => {
    const rows = readRows([
      ofxRow({ date: null }),
      ofxRow({ amount: null }),
      ofxRow({ date: 'not a date' }),
      ofxRow({ amount: '0' }),
      ofxRow({ date: '18000101' }),
      ofxRow({ amount: '1,234.5' }),
    ]);
    expect(rows.map((row) => row.status === 'invalid' && row.reason)).toEqual([
      'cell_missing',
      'cell_missing',
      'date_invalid',
      'amount_zero',
      'date_out_of_range',
      'amount_invalid',
    ]);
  });

  describe('bank reference', () => {
    const read = (reference: string | null) => readRows([ofxRow({ reference })])[0] as ReadyRow;

    it('keeps a reference of at most 255 characters', () => {
      expect(read('r'.repeat(255)).bankReference).toBe('r'.repeat(255));
    });

    it('ignores a longer reference or none', () => {
      expect(read('r'.repeat(256)).bankReference).toBeNull();
      expect(read(null).bankReference).toBeNull();
    });
  });

  describe('third party', () => {
    const read = (name: string) => readRows([ofxRow({ name })])[0] as ReadyRow;

    it('leaves the dates, times and amounts of the label out and keeps the label in the notes', () => {
      expect(read('LA BOULANGERIE 05/03 12,50EUR')).toMatchObject({
        thirdParty: 'LA BOULANGERIE',
        notes: 'LA BOULANGERIE 05/03 12,50EUR',
        sourceLabel: 'LA BOULANGERIE 05/03 12,50EUR',
        labelOrigin: 'file',
      });
    });

    it('leaves the notes empty when the label holds nothing to leave out', () => {
      expect(read('EDF ENERGIE')).toMatchObject({ thirdParty: 'EDF ENERGIE', notes: '' });
    });

    it('keeps the label as the third party when nothing else would be left', () => {
      expect(read('05/03 12,50')).toMatchObject({ thirdParty: '05/03 12,50', notes: '' });
    });

    it('cuts a long third party to 64 characters and keeps the label in the notes', () => {
      const label = `${'A'.repeat(70)} 05/03`;
      expect(read(label)).toMatchObject({ thirdParty: 'A'.repeat(64), notes: label });
    });
  });

  describe('payment method', () => {
    const read = (type: string | null, amount = '-1') =>
      (readRows([ofxRow({ type, amount })])[0] as ReadyRow).paymentMethodId;

    it.each([
      ['POS', PAYMENT_METHOD_ID.CREDIT_CARD],
      ['ATM', PAYMENT_METHOD_ID.CASH_WITHDRAWAL],
      ['CASH', PAYMENT_METHOD_ID.CASH_WITHDRAWAL],
      ['CHECK', PAYMENT_METHOD_ID.CHECK_DEBIT],
      ['XFER', PAYMENT_METHOD_ID.TRANSFER_DEBIT],
      ['DIRECTDEBIT', PAYMENT_METHOD_ID.DIRECT_DEBIT],
      ['REPEATPMT', PAYMENT_METHOD_ID.DIRECT_DEBIT],
      ['pos', PAYMENT_METHOD_ID.CREDIT_CARD],
    ])('reads the debit type %s', (type, expected) => {
      expect(read(type)).toBe(expected);
    });

    it.each([
      ['CHECK', PAYMENT_METHOD_ID.CHECK_CREDIT],
      ['XFER', PAYMENT_METHOD_ID.TRANSFER_CREDIT],
      ['DEP', PAYMENT_METHOD_ID.DEPOSIT],
      ['DIRECTDEP', PAYMENT_METHOD_ID.DEPOSIT],
    ])('reads the credit type %s', (type, expected) => {
      expect(read(type, '1')).toBe(expected);
    });

    it('takes the default of its side for a type the side cannot carry, an unknown one or none', () => {
      expect(read('DEP')).toBe(PAYMENT_METHOD_ID.CREDIT_CARD);
      expect(read('POS', '1')).toBe(PAYMENT_METHOD_ID.DEPOSIT);
      expect(read('OTHER')).toBe(PAYMENT_METHOD_ID.CREDIT_CARD);
      expect(read('constructor')).toBe(PAYMENT_METHOD_ID.CREDIT_CARD);
      expect(read(null, '1')).toBe(PAYMENT_METHOD_ID.DEPOSIT);
    });

    describe('from the label', () => {
      const fromLabel = (name: string, amount = '-1', type: string | null = 'DEBIT') =>
        (readRows([ofxRow({ name, amount, type })])[0] as ReadyRow).paymentMethodId;

      it.each([
        ['PAIEMENT CB 0305 BOULANGERIE', PAYMENT_METHOD_ID.CREDIT_CARD],
        ['CB*4711 BOULANGERIE', PAYMENT_METHOD_ID.CREDIT_CARD],
        ['ACHAT CARTE X1234 LECLERC', PAYMENT_METHOD_ID.CREDIT_CARD],
        ['CARD PURCHASE TESCO', PAYMENT_METHOD_ID.CREDIT_CARD],
        ['RETRAIT DAB PARIS', PAYMENT_METHOD_ID.CASH_WITHDRAWAL],
        ['ATM WITHDRAWAL LONDON', PAYMENT_METHOD_ID.CASH_WITHDRAWAL],
        ['PRLV SEPA EDF', PAYMENT_METHOD_ID.DIRECT_DEBIT],
        ['PRÉLÈVEMENT FREE', PAYMENT_METHOD_ID.DIRECT_DEBIT],
        ['DIRECT DEBIT NETFLIX', PAYMENT_METHOD_ID.DIRECT_DEBIT],
        ['VIR SEPA LOYER', PAYMENT_METHOD_ID.TRANSFER_DEBIT],
        ['VIREMENT PERMANENT', PAYMENT_METHOD_ID.TRANSFER_DEBIT],
        ['VERS LIVRET A', PAYMENT_METHOD_ID.TRANSFER_DEBIT],
        ['FASTER PAYMENT TO JOHN', PAYMENT_METHOD_ID.TRANSFER_DEBIT],
        ['CHQ 0001234', PAYMENT_METHOD_ID.CHECK_DEBIT],
        ['Chèque 1234', PAYMENT_METHOD_ID.CHECK_DEBIT],
      ])('reads the debit label %s', (name, expected) => {
        expect(fromLabel(name)).toBe(expected);
      });

      it.each([
        ['VIR SEPA SALAIRE', PAYMENT_METHOD_ID.TRANSFER_CREDIT],
        ['VERS COMPTE COURANT', PAYMENT_METHOD_ID.TRANSFER_CREDIT],
        ['WIRE TRANSFER ACME', PAYMENT_METHOD_ID.TRANSFER_CREDIT],
        ['REMISE CHEQUES 12', PAYMENT_METHOD_ID.CHECK_CREDIT],
        ['VERSEMENT ESPECES', PAYMENT_METHOD_ID.DEPOSIT],
        ['DÉPÔT GUICHET', PAYMENT_METHOD_ID.DEPOSIT],
        ['CASH DEPOSIT', PAYMENT_METHOD_ID.DEPOSIT],
      ])('reads the credit label %s', (name, expected) => {
        expect(fromLabel(name, '1', 'CREDIT')).toBe(expected);
      });

      it('reads a missing type from the label too', () => {
        expect(fromLabel('RETRAIT DAB', '-1', null)).toBe(PAYMENT_METHOD_ID.CASH_WITHDRAWAL);
      });

      it('prefers the type of the file to the label', () => {
        expect(fromLabel('RETRAIT DAB', '-1', 'POS')).toBe(PAYMENT_METHOD_ID.CREDIT_CARD);
      });

      it('picks the first rule whose method suits the sign, in the order of the rules', () => {
        expect(fromLabel('RETRAIT CARTE')).toBe(PAYMENT_METHOD_ID.CASH_WITHDRAWAL);
        expect(fromLabel('CARTE VIR')).toBe(PAYMENT_METHOD_ID.TRANSFER_DEBIT);
        expect(fromLabel('REMBOURSEMENT CARTE VIR', '1')).toBe(PAYMENT_METHOD_ID.TRANSFER_CREDIT);
      });

      it('ignores a method the sign cannot carry', () => {
        expect(fromLabel('CARTE SUPERMARCHE', '1')).toBe(PAYMENT_METHOD_ID.DEPOSIT);
        expect(fromLabel('VERSEMENT')).toBe(PAYMENT_METHOD_ID.CREDIT_CARD);
      });

      it('matches whole words only and falls to the default otherwise', () => {
        expect(fromLabel('CARTOUCHE ENCRE')).toBe(PAYMENT_METHOD_ID.CREDIT_CARD);
        expect(fromLabel('CAFE VERSAILLES')).toBe(PAYMENT_METHOD_ID.CREDIT_CARD);
        expect(fromLabel('VERSEMENT ESPECES', '5', 'CREDIT')).toBe(PAYMENT_METHOD_ID.DEPOSIT);
        expect(fromLabel('VIRGIN ACTIVE', '-1', 'DEBIT')).toBe(PAYMENT_METHOD_ID.CREDIT_CARD);
        expect(fromLabel('DABBLE', '1')).toBe(PAYMENT_METHOD_ID.DEPOSIT);
        expect(fromLabel('RESTAURANT')).toBe(PAYMENT_METHOD_ID.CREDIT_CARD);
      });

      it('reads the label of the file, not the memo of a named row', () => {
        const rows = readRows([
          ofxRow({ name: '', memo: 'RETRAIT DAB' }),
          ofxRow({ name: 'SHOP', memo: 'RETRAIT DAB' }),
        ]) as ReadyRow[];
        expect(rows.map((row) => row.paymentMethodId)).toEqual([
          PAYMENT_METHOD_ID.CASH_WITHDRAWAL,
          PAYMENT_METHOD_ID.CREDIT_CARD,
        ]);
      });

      it('ignores a keyword beyond the first 256 characters', () => {
        expect(fromLabel(`${'x'.repeat(300)} RETRAIT`)).toBe(PAYMENT_METHOD_ID.CREDIT_CARD);
      });
    });

    it('lets a payment method picked for a line replace the guess of that line only', () => {
      const rows = readRows(
        [ofxRow({ name: 'RETRAIT DAB' }), ofxRow({ type: 'POS' }), ofxRow({ amount: '1' })],
        NO_LABEL_RULES,
        new Map([
          [1, PAYMENT_METHOD_ID.DIRECT_DEBIT],
          [3, PAYMENT_METHOD_ID.CHECK_CREDIT],
        ]),
      ) as ReadyRow[];
      expect(rows.map((row) => row.paymentMethodId)).toEqual([
        PAYMENT_METHOD_ID.DIRECT_DEBIT,
        PAYMENT_METHOD_ID.CREDIT_CARD,
        PAYMENT_METHOD_ID.CHECK_CREDIT,
      ]);
    });

    it('takes Credit card for a debit and Deposit for a credit that nothing names', () => {
      const rows = readRows([ofxRow(), ofxRow({ amount: '1' })]) as ReadyRow[];
      expect(rows.map((row) => row.paymentMethodId)).toEqual([
        PAYMENT_METHOD_ID.CREDIT_CARD,
        PAYMENT_METHOD_ID.DEPOSIT,
      ]);
    });
  });
});

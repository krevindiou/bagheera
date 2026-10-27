import { PAYMENT_METHOD_ID } from '@bagheera/reference-data';
import { accountMarkOf, revisionOf, type Evidence } from './revision';

describe('revisionOf', () => {
  const evidence = (overrides: Partial<Evidence> = {}): Evidence => ({
    corrections: new Map([['bakery', 'Boulangerie']]),
    methods: [
      {
        type: 'debit',
        thirdParty: 'bakery',
        paymentMethodId: 'm1',
        uses: 2,
        lastDate: '2026-01-01',
      },
    ],
    categories: [
      { type: 'debit', thirdParty: 'bakery', categoryId: 'c1', uses: 2, lastDate: '2026-01-01' },
    ],
    transfers: [
      { type: 'debit', thirdParty: 'savings', accountId: 'a1', uses: 1, lastDate: '2026-01-01' },
    ],
    recorded: [
      {
        id: 'op-1',
        reconciled: false,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        valueDate: '2026-03-05',
        debit: 125000,
        credit: null,
        thirdParty: 'Bakery',
        sourceLabel: null,
        bankReference: null,
      },
    ],
    rows: [
      {
        status: 'skipped',
        line: 1,
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
        bankReference: null,
        recorded: {
          operationId: 'op-1',
          valueDate: '2026-03-05',
          thirdParty: 'Bakery',
          reconciled: false,
          matchedBy: 'details',
        },
      },
    ],
    ...overrides,
  });

  it('is a SHA-256 hex digest, the same for the same evidence', () => {
    expect(revisionOf(evidence())).toMatch(/^[0-9a-f]{64}$/);
    expect(revisionOf(evidence())).toBe(revisionOf(evidence()));
  });

  it('does not depend on the order the database returned the evidence in', () => {
    const [first, second] = [
      { type: 'debit', thirdParty: 'a', categoryId: 'c1', uses: 1, lastDate: '2026-01-01' },
      { type: 'debit', thirdParty: 'b', categoryId: 'c2', uses: 1, lastDate: '2026-01-02' },
    ] as const;
    expect(revisionOf(evidence({ categories: [first, second] }))).toBe(
      revisionOf(evidence({ categories: [second, first] })),
    );
  });

  it.each<[string, Partial<Evidence>]>([
    ['a correction', { corrections: new Map([['bakery', 'Bakery']]) }],
    ['a payment method use', { methods: [] }],
    ['a category use', { categories: [] }],
    ['a transfer use', { transfers: [] }],
    ['a recorded operation', { recorded: [] }],
  ])('changes with %s', (_, change) => {
    expect(revisionOf(evidence(change))).not.toBe(revisionOf(evidence()));
  });

  it('does not change when more operations back the same suggestions', () => {
    const [method] = evidence().methods;
    const [category] = evidence().categories;
    const [transfer] = evidence().transfers;
    expect(
      revisionOf(
        evidence({
          methods: [{ ...method, uses: 9, lastDate: '2026-02-01' }],
          categories: [{ ...category, uses: 9, lastDate: '2026-02-01' }],
          transfers: [{ ...transfer, uses: 9, lastDate: '2026-02-01' }],
        }),
      ),
    ).toBe(revisionOf(evidence()));
  });

  it('does not change with a use of a choice that stays behind', () => {
    const [category] = evidence().categories;
    expect(
      revisionOf(evidence({ categories: [category, { ...category, categoryId: 'c2', uses: 1 }] })),
    ).toBe(revisionOf(evidence()));
  });

  it('changes when another choice becomes the most used one', () => {
    const [category] = evidence().categories;
    expect(
      revisionOf(evidence({ categories: [category, { ...category, categoryId: 'c2', uses: 3 }] })),
    ).not.toBe(revisionOf(evidence()));
  });

  it('does not depend on the order of uses that tie', () => {
    const [category] = evidence().categories;
    const other = { ...category, categoryId: 'c0' };
    expect(revisionOf(evidence({ categories: [category, other] }))).toBe(
      revisionOf(evidence({ categories: [other, category] })),
    );
  });

  it('changes when a pick moves a row from skipped to imported', () => {
    const [row] = evidence().rows;
    if (row.status === 'invalid') throw new Error('unexpected');
    expect(revisionOf(evidence({ rows: [{ ...row, status: 'import', recorded: null }] }))).not.toBe(
      revisionOf(evidence()),
    );
  });

  it('changes when a row is skipped on another operation', () => {
    const [row] = evidence().rows;
    if (row.status === 'invalid' || !row.recorded) throw new Error('unexpected');
    expect(
      revisionOf(
        evidence({ rows: [{ ...row, recorded: { ...row.recorded, operationId: 'op-2' } }] }),
      ),
    ).not.toBe(revisionOf(evidence()));
  });

  it('does not change with what only the Member chose, such as a category', () => {
    const [row] = evidence().rows;
    if (row.status === 'invalid') throw new Error('unexpected');
    expect(
      revisionOf(evidence({ rows: [{ ...row, categoryId: 'c1', categoryOrigin: 'picked' }] })),
    ).toBe(revisionOf(evidence()));
  });

  it('changes when a recorded operation is reconciled', () => {
    const [operation] = evidence().recorded;
    expect(revisionOf(evidence({ recorded: [{ ...operation, reconciled: true }] }))).not.toBe(
      revisionOf(evidence()),
    );
  });

  describe('accountMarkOf', () => {
    it('is the same for the same operations and places, whatever the order of the operations', () => {
      const { recorded, rows } = evidence();
      const other = { ...recorded[0], id: 'op-0' };
      expect(accountMarkOf([...recorded, other], rows)).toBe(
        accountMarkOf([other, ...recorded], rows),
      );
    });

    it('changes with an operation entered, or a row placed elsewhere', () => {
      const { recorded, rows } = evidence();
      const [row] = rows;
      if (row.status === 'invalid') throw new Error('unexpected');
      expect(accountMarkOf([...recorded, { ...recorded[0], id: 'op-2' }], rows)).not.toBe(
        accountMarkOf(recorded, rows),
      );
      expect(accountMarkOf(recorded, [{ ...row, status: 'import', recorded: null }])).not.toBe(
        accountMarkOf(recorded, rows),
      );
    });

    it('does not depend on the corrections or the suggestions', () => {
      const { recorded, rows } = evidence({ corrections: new Map(), methods: [] });
      expect(accountMarkOf(recorded, rows)).toBe(
        accountMarkOf(evidence().recorded, evidence().rows),
      );
    });
  });
});

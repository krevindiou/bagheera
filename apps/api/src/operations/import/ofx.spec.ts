import { ofxFile } from '../../test-support/ofx-files';
import { OfxFormatError, OfxLimitError, OfxStatementError, parseOfx } from './ofx';

const limits = { maxRows: 5000 };

const rows = [
  {
    type: 'POS',
    date: '20260305120000',
    amount: '-12.50',
    reference: 'A1',
    name: 'Bakery',
    memo: 'Card 1234',
  },
  { type: 'DEP', date: '20260306', amount: '1000.00', reference: 'A2', name: 'Employer' },
];

describe('parseOfx', () => {
  it.each([
    ['version 1.x', { version: 1 }],
    ['version 2.x', { version: 2 }],
    ['version 1.x in UTF-8', { version: 1, charset: 'utf-8' }],
    ['version 2.x in UTF-8', { version: 2, charset: 'utf-8' }],
  ] as const)('reads the rows of a %s file', (_label, options) => {
    expect(parseOfx(ofxFile(rows, options), limits)).toEqual({
      kind: 'bank',
      currency: 'EUR',
      closing: null,
      accountRef: { bankId: '12345', accountId: '00012345' },
      rows: [
        {
          type: 'POS',
          date: '20260305120000',
          amount: '-12.50',
          reference: 'A1',
          name: 'Bakery',
          memo: 'Card 1234',
        },
        {
          type: 'DEP',
          date: '20260306',
          amount: '1000.00',
          reference: 'A2',
          name: 'Employer',
          memo: '',
        },
      ],
    });
  });

  it.each([1, 2] as const)(
    'reads the closing balance and not the available one (version %i)',
    (version) => {
      const closing = { amount: '-1234.56', date: '20260331' };
      expect(parseOfx(ofxFile(rows, { version, closing }), limits).closing).toEqual(closing);
    },
  );

  it('reads the account of a bank statement and of a credit-card statement', () => {
    expect(parseOfx(ofxFile(rows, { accountId: 'FR76 1234' }), limits).accountRef).toEqual({
      bankId: '12345',
      accountId: 'FR76 1234',
    });
    expect(
      parseOfx(ofxFile(rows, { kind: 'creditcard', accountId: '4111' }), limits).accountRef,
    ).toEqual({ bankId: '', accountId: '4111' });
  });

  it('reads no account from a statement that names none or an absurdly long one', () => {
    expect(parseOfx(ofxFile(rows, { accountId: null }), limits).accountRef).toBeNull();
    expect(parseOfx(ofxFile(rows, { accountId: 'A'.repeat(129) }), limits).accountRef).toBeNull();
  });

  it('reads a credit-card statement', () => {
    const statement = parseOfx(ofxFile(rows, { kind: 'creditcard', currency: 'USD' }), limits);
    expect(statement.kind).toBe('creditcard');
    expect(statement.currency).toBe('USD');
  });

  it.each([
    ['windows-1252', 'Café Zoë', 1],
    ['utf-8', 'Café Zoë — €', 1],
    ['utf-8', 'Café Zoë — €', 2],
  ] as const)('decodes %s text (version %i)', (charset, name, version) => {
    const [row] = parseOfx(ofxFile([{ ...rows[0], name }], { charset, version }), limits).rows;
    expect(row.name).toBe(name);
  });

  it('reads the predefined and numeric entities', () => {
    const [row] = parseOfx(ofxFile([{ ...rows[0], name: 'Tom & Jerry <3' }]), limits).rows;
    expect(row.name).toBe('Tom & Jerry <3');
    const file = Buffer.from(
      ofxFile(rows)
        .toString('latin1')
        .replace('Bakery', '&#233;t&#xE9; &quot;x&quot; &apos;y&apos; &#0; &#1114112; 2 &gt; 1'),
      'latin1',
    );
    expect(parseOfx(file, limits).rows[0].name).toBe('été "x" \'y\' &#0; &#1114112; 2 > 1');
  });

  it('reads text escaped twice, as some banks send it', () => {
    const file = Buffer.from(
      ofxFile(rows)
        .toString('latin1')
        .replace('Bakery', 'L&amp;apos;EPICERIE &amp;amp; CO &amp;#233;'),
      'latin1',
    );
    expect(parseOfx(file, limits).rows[0].name).toBe("L'EPICERIE & CO é");
  });

  it('ignores the rows of a currency override and other nested elements', () => {
    const file = Buffer.from(
      ofxFile(rows)
        .toString('latin1')
        .replace(
          '<NAME>Bakery',
          '<CURRENCY>\n<CURRATE>1.1\n<CURSYM>USD\n</CURRENCY>\n<NAME>Bakery',
        ),
      'latin1',
    );
    const statement = parseOfx(file, limits);
    expect(statement.currency).toBe('EUR');
    expect(statement.rows[0].name).toBe('Bakery');
  });

  it('keeps a missing field as absent', () => {
    const [row] = parseOfx(ofxFile([{ date: '20260305', amount: '1' }]), limits).rows;
    expect(row).toEqual({
      type: 'DEBIT',
      date: '20260305',
      amount: '1',
      reference: null,
      name: '',
      memo: '',
    });
  });

  it('reads a file without the OFX header', () => {
    const body = ofxFile(rows).toString('latin1');
    const headless = Buffer.from(body.slice(body.indexOf('<OFX>')), 'latin1');
    expect(parseOfx(headless, limits).rows).toHaveLength(2);
  });

  it('reads a UTF-8 file that starts with a byte order mark', () => {
    const file = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      ofxFile(rows, { charset: 'utf-8' }),
    ]);
    expect(parseOfx(file, limits).rows).toHaveLength(2);
  });

  it('refuses text that is not valid in the declared UTF-8', () => {
    const file = Buffer.from(
      ofxFile(rows, { charset: 'utf-8' }).toString('latin1').replace('Bakery', 'Caf\xe9'),
      'latin1',
    );
    expect(() => parseOfx(file, limits)).toThrow(OfxFormatError);
  });

  it('reads UTF-8 text of a file that declares no character set', () => {
    const file = Buffer.from(
      ofxFile([{ ...rows[0], name: 'Café Zoë' }], { charset: 'utf-8' })
        .toString('utf8')
        .replace('ENCODING:UTF-8', 'ENCODING:USASCII'),
      'utf8',
    );
    expect(parseOfx(file, limits).rows[0].name).toBe('Café Zoë');
  });

  it('falls back to Windows-1252 for a file that declares no character set', () => {
    const file = Buffer.from(
      ofxFile([{ ...rows[0], name: 'Café Zoë' }])
        .toString('latin1')
        .replace('CHARSET:1252', 'CHARSET:NONE'),
      'latin1',
    );
    expect(parseOfx(file, limits).rows[0].name).toBe('Café Zoë');
  });

  it.each([1, 2] as const)('reads the name of a payee element (version %i)', (version) => {
    const file = Buffer.from(
      ofxFile(rows, { version })
        .toString('latin1')
        .replace('<NAME>Bakery</NAME>', '<PAYEE><NAME>Bakery</NAME></PAYEE>'),
      'latin1',
    );
    expect(parseOfx(file, limits).rows[0].name).toBe('Bakery');
  });

  it.each([1, 2] as const)('reads the leaves after an empty one (version %i)', (version) => {
    const file = Buffer.from(
      ofxFile([{ ...rows[0], memo: '' }], { version }).toString('latin1'),
      'latin1',
    );
    expect(parseOfx(file, limits).rows[0]).toEqual({
      type: 'POS',
      date: '20260305120000',
      amount: '-12.50',
      reference: 'A1',
      name: 'Bakery',
      memo: '',
    });
  });

  it.each([1, 2] as const)(
    'reads the leaves after an empty element it does not know (version %i)',
    (version) => {
      const file = Buffer.from(
        ofxFile([rows[0]], { version })
          .toString('latin1')
          .replace('<NAME>', version === 2 ? '<CHECKNUM></CHECKNUM><NAME>' : '<CHECKNUM>\n<NAME>'),
        'latin1',
      );
      expect(parseOfx(file, limits).rows[0]).toMatchObject({ name: 'Bakery', memo: 'Card 1234' });
    },
  );

  it.each([
    ['an unsupported character set', 'CHARSET:1252', 'CHARSET:KLINGON'],
    ['an unsupported version', 'VERSION:102', 'VERSION:300'],
  ])('refuses %s', (_label, from, to) => {
    const file = Buffer.from(ofxFile(rows).toString('latin1').replace(from, to), 'latin1');
    expect(() => parseOfx(file, limits)).toThrow(OfxFormatError);
  });

  it.each([
    ['a file that is not OFX', 'Date;Amount\n05/03/2026;12'],
    ['an empty file', ''],
    ['binary content', '\u0000\u0001\u0002'],
  ])('refuses %s', (_label, text) => {
    expect(() => parseOfx(Buffer.from(text), limits)).toThrow(OfxFormatError);
  });

  it('refuses a file without a statement or without a currency', () => {
    expect(() => parseOfx(Buffer.from('OFXHEADER:100\n\n<OFX>\n</OFX>'), limits)).toThrow(
      OfxFormatError,
    );
    const noCurrency = ofxFile(rows).toString('latin1').replace('<CURDEF>EUR', '');
    expect(() => parseOfx(Buffer.from(noCurrency, 'latin1'), limits)).toThrow(OfxFormatError);
  });

  it.each([
    ['a NUL character in a label', (text: string) => text.replace('Bakery', 'Bak\u0000ery')],
    ['a NUL character in a bank reference', (text: string) => text.replace('A1', 'A\u00001')],
    [
      'a currency that is not three letters',
      (text: string) => text.replace('<CURDEF>EUR', '<CURDEF>EURO'),
    ],
    ['a currency with digits', (text: string) => text.replace('<CURDEF>EUR', '<CURDEF>E1R')],
    [
      'a very long currency',
      (text: string) => text.replace('<CURDEF>EUR', `<CURDEF>${'E'.repeat(100_000)}`),
    ],
  ])('refuses %s', (_label, change) => {
    const file = Buffer.from(change(ofxFile(rows).toString('latin1')), 'latin1');
    expect(() => parseOfx(file, limits)).toThrow(OfxFormatError);
  });

  it('refuses several statements', () => {
    const text = ofxFile(rows).toString('latin1');
    const second = text.slice(text.indexOf('<STMTTRNRS>'), text.indexOf('</STMTTRNRS>') + 12);
    const doubled = text.replace('</BANKMSGSRSV1>', `${second}\n</BANKMSGSRSV1>`);
    expect(() => parseOfx(Buffer.from(doubled, 'latin1'), limits)).toThrow(
      expect.objectContaining({ reason: 'several' }),
    );
  });

  it('refuses a statement that is neither a bank nor a credit-card one', () => {
    const text = ofxFile(rows)
      .toString('latin1')
      .replace(/STMTRS/g, 'INVSTMTRS');
    const refusal = (): unknown => parseOfx(Buffer.from(text, 'latin1'), limits);
    expect(refusal).toThrow(OfxStatementError);
    expect(refusal).toThrow(expect.objectContaining({ reason: 'unsupported' }));
  });

  it('stops at the row limit', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ ...rows[0], reference: `R${i}` }));
    expect(parseOfx(ofxFile(many), { maxRows: 6 }).rows).toHaveLength(6);
    expect(() => parseOfx(ofxFile(many), { maxRows: 5 })).toThrow(OfxLimitError);
  });

  describe('hostile files', () => {
    const wrap = (inner: string) =>
      Buffer.from(
        ofxFile(rows, { version: 2 })
          .toString('latin1')
          .replace('<OFX>', inner + '<OFX>'),
        'latin1',
      );

    it('never resolves a declared entity or an external one', () => {
      const file = wrap(
        '<!DOCTYPE OFX [<!ENTITY secret SYSTEM "file:///etc/passwd"><!ENTITY big "aaaa">]>\n',
      )
        .toString('latin1')
        .replace('Bakery', '&secret;&big;&secret;');
      const [row] = parseOfx(Buffer.from(file, 'latin1'), limits).rows;
      expect(row.name).toBe('&secret;&big;&secret;');
    });

    it('stays linear on a billion-laughs shaped file', () => {
      const entities = Array.from({ length: 10 }, (_, i) => {
        const previous = i === 0 ? 'lol' : `l${i - 1}`;
        return `<!ENTITY l${i} "${`&${previous};`.repeat(10)}">`;
      }).join('');
      const file = wrap(`<!DOCTYPE OFX [<!ENTITY lol "lol">${entities}]>\n`)
        .toString('latin1')
        .replace('Bakery', '&l9;');
      const started = Date.now();
      const [row] = parseOfx(Buffer.from(file, 'latin1'), limits).rows;
      expect(row.name).toBe('&l9;');
      expect(Date.now() - started).toBeLessThan(500);
    });

    it('refuses nesting that is too deep, quickly', () => {
      const deep = '<STMTTRN>'.repeat(100);
      expect(() => parseOfx(Buffer.from(`<OFX>${deep}`), limits)).toThrow(OfxFormatError);
    });

    it('stays linear on a file of unterminated tags and mismatched closes', () => {
      const started = Date.now();
      for (const junk of ['<a '.repeat(1_500_000), '<A>'.repeat(60) + '</B>'.repeat(1_000_000)]) {
        expect(() => parseOfx(Buffer.from(`<OFX>${junk}`), limits)).toThrow(OfxFormatError);
      }
      expect(Date.now() - started).toBeLessThan(2000);
    });
  });
});

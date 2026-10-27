export interface TestTransaction {
  type?: string;
  date?: string;
  amount?: string;
  reference?: string;
  name?: string;
  memo?: string;
}

export interface TestOfxOptions {
  currency?: string;
  kind?: 'bank' | 'creditcard';
  // Version 2.x is XML; 1.x leaves leaf elements unclosed.
  version?: 1 | 2;
  // Declared and used to encode; windows-1252 or utf-8.
  charset?: 'windows-1252' | 'utf-8';
  // The ledger balance the statement closes with.
  closing?: { amount: string; date: string };
  // The account the statement names; null leaves the identifiers out.
  accountId?: string | null;
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// A bank file with one statement holding the given rows, for tests.
export function ofxFile(rows: TestTransaction[], options: TestOfxOptions = {}): Buffer {
  const {
    currency = 'EUR',
    kind = 'bank',
    version = 1,
    charset = 'windows-1252',
    closing,
    accountId = '00012345',
  } = options;
  const leaf = (name: string, value: string | undefined) =>
    value === undefined ? '' : version === 2 ? `<${name}>${value}</${name}>` : `<${name}>${value}`;
  const open = (name: string) => `<${name}>`;
  const close = (name: string) => `</${name}>`;

  const transactions = rows
    .map((row) =>
      [
        open('STMTTRN'),
        leaf('TRNTYPE', row.type ?? 'DEBIT'),
        leaf('DTPOSTED', row.date),
        leaf('TRNAMT', row.amount),
        leaf('FITID', row.reference),
        leaf('NAME', row.name === undefined ? undefined : escape(row.name)),
        leaf('MEMO', row.memo === undefined ? undefined : escape(row.memo)),
        close('STMTTRN'),
      ].join('\n'),
    )
    .join('\n');

  const statement = kind === 'bank' ? 'STMTRS' : 'CCSTMTRS';
  const account =
    accountId === null
      ? []
      : kind === 'bank'
        ? [
            open('BANKACCTFROM'),
            leaf('BANKID', '12345'),
            leaf('ACCTID', accountId),
            close('BANKACCTFROM'),
          ]
        : [open('CCACCTFROM'), leaf('ACCTID', accountId), close('CCACCTFROM')];
  const balance = closing
    ? [
        open('LEDGERBAL'),
        leaf('BALAMT', closing.amount),
        leaf('DTASOF', closing.date),
        close('LEDGERBAL'),
        // The available balance has the same leaves and must not be read.
        open('AVAILBAL'),
        leaf('BALAMT', '999999.99'),
        leaf('DTASOF', '20990101'),
        close('AVAILBAL'),
      ]
    : [];
  const body = [
    open('OFX'),
    open('BANKMSGSRSV1'),
    open('STMTTRNRS'),
    leaf('TRNUID', '1'),
    open(statement),
    leaf('CURDEF', currency),
    ...account,
    open('BANKTRANLIST'),
    leaf('DTSTART', '20260101'),
    leaf('DTEND', '20261231'),
    transactions,
    close('BANKTRANLIST'),
    ...balance,
    close(statement),
    close('STMTTRNRS'),
    close('BANKMSGSRSV1'),
    close('OFX'),
  ].join('\n');

  const utf8 = charset === 'utf-8';
  const header =
    version === 2
      ? `<?xml version="1.0" encoding="${utf8 ? 'UTF-8' : 'windows-1252'}"?>\n<?OFX OFXHEADER="200" VERSION="211" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>\n`
      : `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:${utf8 ? 'UTF-8' : 'USASCII'}\nCHARSET:${utf8 ? 'NONE' : '1252'}\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE\n\n`;
  return Buffer.from(header + body, utf8 ? 'utf8' : 'latin1');
}

export class OfxFormatError extends Error {}

export class OfxLimitError extends Error {}

// A file holding more than one statement, or one that is neither a bank nor a
// credit-card statement.
export class OfxStatementError extends Error {
  constructor(readonly reason: 'several' | 'unsupported') {
    super(`OFX statement refused: ${reason}.`);
  }
}

// What a row says, as text: reading it as a date or an amount is up to rows/cell-values.
export interface OfxRow {
  date: string | null;
  amount: string | null;
  type: string | null;
  name: string;
  memo: string;
  reference: string | null;
}

export interface OfxStatement {
  kind: 'bank' | 'creditcard';
  currency: string;
  rows: OfxRow[];
  // The ledger balance the statement closes with, as text.
  closing: { amount: string; date: string } | null;
  // The bank and account identifiers the statement names, as text.
  accountRef: { bankId: string; accountId: string } | null;
}

const LEAF_NAMES = new Set([
  'DTPOSTED',
  'TRNAMT',
  'TRNTYPE',
  'FITID',
  'NAME',
  'MEMO',
  'CURDEF',
  'BALAMT',
  'DTASOF',
  'BANKID',
  'ACCTID',
]);
// The elements whose children are read; the statement elements are told apart
// by their suffix. Version 1.x leaves leaves unclosed, so only these are
// tracked as open.
const AGGREGATE_NAMES = new Set(['STMTTRN', 'PAYEE', 'LEDGERBAL', 'BANKACCTFROM', 'CCACCTFROM']);

function isAggregate(name: string): boolean {
  return AGGREGATE_NAMES.has(name) || name.endsWith('STMTRS');
}

// Identifiers are echoed nowhere; the cap only bounds what is kept.
const MAX_REF_CHARS = 128;
const HEADER_BYTES = 2048;
// No OFX statement nests deeper; the cap keeps closing tags cheap to look up.
const MAX_DEPTH = 64;
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

const CHARSETS: Record<string, string> = {
  'utf-8': 'utf-8',
  utf8: 'utf-8',
  unicode: 'utf-8',
  '1252': 'windows-1252',
  'windows-1252': 'windows-1252',
  cp1252: 'windows-1252',
  'iso-8859-1': 'windows-1252',
  'iso8859-1': 'windows-1252',
  '8859-1': 'windows-1252',
  latin1: 'windows-1252',
  'us-ascii': 'windows-1252',
  usascii: 'windows-1252',
  ascii: 'windows-1252',
};

function charsetOf(label: string): string {
  const charset = CHARSETS[label.trim().toLowerCase()];
  if (!charset) throw new OfxFormatError('Unsupported character set.');
  return charset;
}

// The character set the file declares: the XML declaration of version 2.x, the
// header lines of version 1.x; null when a 1.x file declares none. Reading the
// header never needs the right decoding, so it is looked at byte by byte.
function declaredCharset(buffer: Buffer): string | null {
  const start = buffer.subarray(0, UTF8_BOM.length).equals(UTF8_BOM) ? UTF8_BOM.length : 0;
  const head = buffer.subarray(start, start + HEADER_BYTES).toString('latin1');
  if (/^\s*<\?xml/i.test(head)) {
    const declaration = /^\s*<\?xml[^>]*\?>/i.exec(head)?.[0] ?? '';
    const encoding = /encoding\s*=\s*["']([^"']+)["']/i.exec(declaration)?.[1];
    return encoding ? charsetOf(encoding) : 'utf-8';
  }

  const fields = new Map<string, string>();
  for (const line of head.slice(0, Math.max(head.indexOf('<'), 0)).split(/\r\n|\r|\n/)) {
    const separator = line.indexOf(':');
    if (separator > 0) {
      fields.set(line.slice(0, separator).trim().toUpperCase(), line.slice(separator + 1).trim());
    }
  }
  const version = fields.get('VERSION');
  if (version !== undefined && !/^[12]/.test(version)) {
    throw new OfxFormatError('Unsupported version.');
  }
  const encoding = fields.get('ENCODING')?.toLowerCase();
  if (encoding === 'utf-8' || encoding === 'unicode') return 'utf-8';
  const charset = fields.get('CHARSET');
  if (charset && charset.toLowerCase() !== 'none') return charsetOf(charset);
  return null;
}

function decodeAs(buffer: Buffer, charset: string): string {
  try {
    return new TextDecoder(charset, { fatal: charset === 'utf-8' }).decode(buffer);
  } catch {
    throw new OfxFormatError('The file is not readable in its character set.');
  }
}

function decode(buffer: Buffer): string {
  const declared = declaredCharset(buffer);
  let text: string;
  if (declared) {
    text = decodeAs(buffer, declared);
  } else {
    // Banks that declare nothing mostly write UTF-8 nowadays, older ones
    // Windows-1252; text that is valid UTF-8 by chance is rarely anything else.
    try {
      text = decodeAs(buffer, 'utf-8');
    } catch {
      text = decodeAs(buffer, 'windows-1252');
    }
  }
  // The database cannot store a NUL in text: refuse it here rather than fail
  // the confirmation after a preview that looked fine.
  if (text.includes('\u0000')) throw new OfxFormatError('The file holds a NUL character.');
  return text;
}

// Only the five predefined entities and numeric references are read; a
// declared entity is never looked up, so nothing is fetched or expanded.
// Banks often escape twice ("&amp;apos;"), so the text is read a second time;
// each pass only shortens it.
function unescapeText(text: string): string {
  return unescapeOnce(unescapeOnce(text));
}

function unescapeOnce(text: string): string {
  return text.replace(
    /&(amp|lt|gt|quot|apos|#\d{1,7}|#x[0-9a-fA-F]{1,6});/g,
    (whole: string, entity: string) => {
      switch (entity) {
        case 'amp':
          return '&';
        case 'lt':
          return '<';
        case 'gt':
          return '>';
        case 'quot':
          return '"';
        case 'apos':
          return "'";
      }
      const code =
        entity[1] === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code)
        : whole;
    },
  );
}

interface Tag {
  closing: boolean;
  name: string;
  text: string;
}

// Version 1.x leaves leaf elements unclosed and version 2.x closes them, so
// the file is read as a flat run of tags, each with the text up to the next
// one. Linear in the file, and no tree to build from hostile nesting.
function* tags(text: string): Generator<Tag> {
  let cursor = 0;
  for (;;) {
    const open = text.indexOf('<', cursor);
    if (open === -1) return;
    const close = text.indexOf('>', open + 1);
    if (close === -1) return;
    const next = text.indexOf('<', close + 1);
    const end = next === -1 ? text.length : next;
    cursor = close + 1;

    const inside = text.slice(open + 1, close);
    if (inside.startsWith('?') || inside.startsWith('!') || inside.endsWith('/')) continue;
    const closing = inside.startsWith('/');
    const name = /^[A-Za-z][A-Za-z0-9._-]*/.exec(closing ? inside.slice(1) : inside)?.[0];
    if (name) yield { closing, name: name.toUpperCase(), text: text.slice(close + 1, end) };
  }
}

export function parseOfx(buffer: Buffer, limits: { maxRows: number }): OfxStatement {
  const text = decode(buffer);
  if (!/<OFX[\s>]/i.test(text)) throw new OfxFormatError('Not an OFX file.');

  const stack: string[] = [];
  const rows: OfxRow[] = [];
  const statements: string[] = [];
  let currency: string | null = null;
  let current: Record<string, string> | null = null;
  const ledger: Record<string, string> = {};
  const identity: Record<string, string> = {};

  for (const tag of tags(text)) {
    if (tag.closing) {
      const at = stack.lastIndexOf(tag.name);
      if (at === -1) continue;
      stack.length = at;
      if (tag.name === 'STMTTRN' && current) {
        if (rows.length >= limits.maxRows) throw new OfxLimitError('Too many rows.');
        rows.push({
          date: current.DTPOSTED ?? null,
          amount: current.TRNAMT ?? null,
          type: current.TRNTYPE ?? null,
          name: current.NAME ?? '',
          memo: current.MEMO ?? '',
          reference: current.FITID ?? null,
        });
        current = null;
      }
      continue;
    }

    const value = unescapeText(tag.text.trim());
    if (value !== '') {
      if (current && ['STMTTRN', 'PAYEE'].includes(stack[stack.length - 1])) {
        if (LEAF_NAMES.has(tag.name) && tag.name !== 'CURDEF') current[tag.name] ??= value;
      } else if (tag.name === 'CURDEF' && currency === null && !current) {
        currency = value;
      } else if (stack[stack.length - 1] === 'LEDGERBAL') {
        if (tag.name === 'BALAMT' || tag.name === 'DTASOF') ledger[tag.name] ??= value;
      } else if (['BANKACCTFROM', 'CCACCTFROM'].includes(stack[stack.length - 1])) {
        if (tag.name === 'BANKID' || tag.name === 'ACCTID') identity[tag.name] ??= value;
      }
      continue;
    }

    // Any other empty element is a leaf: version 1.x never closes it, so it
    // would stand in for the element that holds the leaves after it.
    if (!isAggregate(tag.name)) continue;
    if (stack.length >= MAX_DEPTH) throw new OfxFormatError('Nested too deep.');
    stack.push(tag.name);
    if (tag.name === 'STMTTRN') current = {};
    if (tag.name.endsWith('STMTRS')) statements.push(tag.name);
  }

  if (statements.length === 0) throw new OfxFormatError('The file holds no statement.');
  if (statements.length > 1) throw new OfxStatementError('several');
  const kind =
    statements[0] === 'STMTRS' ? 'bank' : statements[0] === 'CCSTMTRS' ? 'creditcard' : null;
  if (!kind) throw new OfxStatementError('unsupported');
  // Echoed back when it differs from the account's, so it must not be free text.
  if (currency === null || !/^[A-Za-z]{3}$/.test(currency)) {
    throw new OfxFormatError('The statement has no valid currency.');
  }
  return {
    kind,
    currency,
    rows,
    closing:
      ledger.BALAMT !== undefined && ledger.DTASOF !== undefined
        ? { amount: ledger.BALAMT, date: ledger.DTASOF }
        : null,
    accountRef:
      identity.ACCTID !== undefined && identity.ACCTID.length <= MAX_REF_CHARS
        ? { bankId: (identity.BANKID ?? '').slice(0, MAX_REF_CHARS), accountId: identity.ACCTID }
        : null,
  };
}

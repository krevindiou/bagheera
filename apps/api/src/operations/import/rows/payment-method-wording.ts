import { PAYMENT_METHOD_ID, type EntryType } from '@bagheera/reference-data';

// The payment method a bank's row type names, by the side of the row; a type the side cannot carry, or none, falls to the label.
const DEBIT_METHODS: ReadonlyMap<string, string> = new Map([
  ['POS', PAYMENT_METHOD_ID.CREDIT_CARD],
  ['ATM', PAYMENT_METHOD_ID.CASH_WITHDRAWAL],
  ['CASH', PAYMENT_METHOD_ID.CASH_WITHDRAWAL],
  ['CHECK', PAYMENT_METHOD_ID.CHECK_DEBIT],
  ['XFER', PAYMENT_METHOD_ID.TRANSFER_DEBIT],
  ['DIRECTDEBIT', PAYMENT_METHOD_ID.DIRECT_DEBIT],
  ['REPEATPMT', PAYMENT_METHOD_ID.DIRECT_DEBIT],
]);
const CREDIT_METHODS: ReadonlyMap<string, string> = new Map([
  ['CHECK', PAYMENT_METHOD_ID.CHECK_CREDIT],
  ['XFER', PAYMENT_METHOD_ID.TRANSFER_CREDIT],
  ['DEP', PAYMENT_METHOD_ID.DEPOSIT],
  ['DIRECTDEP', PAYMENT_METHOD_ID.DEPOSIT],
]);

// Words of a bank label that name a payment method, French and English, in the
// order they win when a label holds several.
const LABEL_METHODS: ReadonlyArray<{
  words: readonly string[];
  debit?: string;
  credit?: string;
}> = [
  {
    words: ['retrait', 'dab', 'atm', 'withdrawal'],
    debit: PAYMENT_METHOD_ID.CASH_WITHDRAWAL,
  },
  {
    words: ['prlv', 'prelevement', 'direct debit'],
    debit: PAYMENT_METHOD_ID.DIRECT_DEBIT,
  },
  {
    words: ['vir', 'virement', 'vers', 'transfer', 'wire', 'bacs', 'faster payment'],
    debit: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
    credit: PAYMENT_METHOD_ID.TRANSFER_CREDIT,
  },
  {
    words: ['chq', 'cheque', 'cheques', 'check'],
    debit: PAYMENT_METHOD_ID.CHECK_DEBIT,
    credit: PAYMENT_METHOD_ID.CHECK_CREDIT,
  },
  {
    words: ['versement', 'depot', 'deposit'],
    credit: PAYMENT_METHOD_ID.DEPOSIT,
  },
  {
    words: ['cb', 'carte', 'card', 'pos'],
    debit: PAYMENT_METHOD_ID.CREDIT_CARD,
  },
];
// Enough for any bank's wording and a bound on the work per row.
const LABEL_WORDS_CHARS = 256;

// A word without case or accents, so that a keyword matches however the bank
// writes it.
function fold(word: string): string {
  return word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

// The label as words between single spaces, so that a keyword matches whole
// words only.
function wordsOf(label: string): string {
  const text = fold(label.slice(0, LABEL_WORDS_CHARS))
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return ` ${text} `;
}

function paymentMethodOfLabel(type: EntryType, label: string): string | undefined {
  const words = wordsOf(label);
  for (const rule of LABEL_METHODS) {
    const method = rule[type];
    if (method && rule.words.some((word) => words.includes(` ${word} `))) return method;
  }
  return undefined;
}

// The words and two-word phrases that name a payment method, as folded words.
const METHOD_PHRASES: ReadonlySet<string> = new Set(
  LABEL_METHODS.flatMap((rule) => rule.words.map(fold)),
);
const CARD_WORDS: ReadonlySet<string> = new Set(['cb', 'carte', 'card']);
const CARD_LEAD_INS: ReadonlySet<string> = new Set([
  'paiement',
  'achat',
  'reglement',
  'payment',
  'purchase',
]);
const METHOD_SUFFIXES: ReadonlySet<string> = new Set([
  'sepa',
  'inst',
  'instantane',
  'permanent',
  'purchase',
  'payment',
]);
const CARD_ENDING = /^x?\d{4}$/;
// Enough words for any bank's prefix and a bound on the work per row.
const LEADING_WORDS = 12;

// The label without the payment-method wording that starts it, however many
// times it is repeated: "PAIEMENT CB 4711 PRLV SEPA EDF" gives "EDF".
export function withoutLeadingMethod(label: string): string {
  const words: { key: string; start: number }[] = [];
  const pattern = /[\p{L}\p{N}]+/gu;
  for (let match = pattern.exec(label); match && words.length < LEADING_WORDS;) {
    words.push({ key: fold(match[0]), start: match.index });
    match = pattern.exec(label);
  }
  const keyAt = (index: number) => words[index]?.key ?? '';

  // "paiement par carte": the index after the phrase, or the start when the
  // word is not the lead-in of a card word.
  const cardPhraseEnd = (index: number) => {
    if (!CARD_LEAD_INS.has(keyAt(index))) return index;
    const card = ['par', 'by'].includes(keyAt(index + 1)) ? index + 2 : index + 1;
    return CARD_WORDS.has(keyAt(card)) ? card + 1 : index;
  };

  let at = 0;
  for (;;) {
    let next = cardPhraseEnd(at);
    if (next === at && METHOD_PHRASES.has(`${keyAt(at)} ${keyAt(at + 1)}`)) next = at + 2;
    else if (next === at && METHOD_PHRASES.has(keyAt(at))) next = at + 1;
    if (next === at) break;

    if (CARD_WORDS.has(keyAt(next - 1)) && CARD_ENDING.test(keyAt(next))) next += 1;
    while (METHOD_SUFFIXES.has(keyAt(next))) next += 1;
    at = next;
  }

  if (at === 0) return label;
  return at >= words.length ? '' : label.slice(words[at].start);
}

// What a row takes when neither its type nor its label names a payment method.
const STANDARD_METHODS: Record<EntryType, string> = {
  debit: PAYMENT_METHOD_ID.CREDIT_CARD,
  credit: PAYMENT_METHOD_ID.DEPOSIT,
};

export function paymentMethodOf(
  type: EntryType,
  rowType: string | null,
  label: string,
): { id: string; standard: boolean } {
  const named =
    rowType === null
      ? undefined
      : (type === 'debit' ? DEBIT_METHODS : CREDIT_METHODS).get(rowType.toUpperCase());
  const found = named ?? paymentMethodOfLabel(type, label);
  return found ? { id: found, standard: false } : { id: STANDARD_METHODS[type], standard: true };
}

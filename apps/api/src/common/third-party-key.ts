import { sql, type AnyColumn } from 'drizzle-orm';

// What String.prototype.trim removes. btrim only removes spaces unless told,
// and the import compares labels trimmed in JS with third parties trimmed in
// SQL.
const TRIMMED_CHARACTERS = [
  0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005,
  0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
];

export const TRIMMED_CHARACTER_CODES: readonly number[] = TRIMMED_CHARACTERS;

// A literal, not a parameter: an expression index only serves a query that
// spells the expression the same way.
const TRIM_SET = sql.raw(
  `E'${TRIMMED_CHARACTERS.map((code) => `\\u${code.toString(16).padStart(4, '0')}`).join('')}'`,
);

/** The SQL twin of normalizeLabel (import/rows/labels.ts): trimmed, lower-cased. */
export function thirdPartyKeyOf(column: AnyColumn) {
  return sql<string>`lower(btrim(${column}, ${TRIM_SET}))`;
}

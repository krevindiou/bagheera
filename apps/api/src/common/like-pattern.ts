/**
 * Escapes ILIKE/LIKE's own wildcard/escape characters (`%`, `_`, `\`) in a
 * user-supplied search term, so a literal "%" or "_" in the term matches
 * itself instead of acting as a pattern wildcard. Order matters: backslash
 * must be escaped first, or escaping % / _ would double-escape the
 * backslashes just added for them. Postgres' default LIKE escape character
 * is backslash, so no `ESCAPE` clause is needed alongside this.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

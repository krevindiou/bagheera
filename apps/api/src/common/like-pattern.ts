import { ilike, SQL } from 'drizzle-orm';

/**
 * Escapes ILIKE/LIKE's own wildcard/escape characters (`%`, `_`, `\`) in a
 * user-supplied search term, so a literal "%" or "_" in the term matches
 * itself instead of acting as a pattern wildcard. Order matters: backslash
 * must be escaped first, or escaping % / _ would double-escape the
 * backslashes just added for them. Postgres' default LIKE escape character
 * is backslash, so no `ESCAPE` clause is needed alongside this.
 */
function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * The only supported way to build a "contains" ILIKE condition in this
 * codebase — wraps `term` in `%...%` and escapes it, so a raw `ilike()` call
 * built by hand (and therefore possibly unescaped) never has to exist.
 * Enforced by the `no-restricted-imports` rule in eslint.config.mjs, which
 * bans importing `ilike` from `drizzle-orm` anywhere outside this file.
 */
export function ilikeContains(
  column: Parameters<typeof ilike>[0],
  term: string,
): SQL {
  return ilike(column, `%${escapeLikePattern(term)}%`);
}

import { ilike, SQL } from 'drizzle-orm';

/**
 * Escapes `%`, `_` and `\` so they match literally. Backslash goes first,
 * or it would double-escape the ones added for % and _. Backslash is
 * Postgres' default LIKE escape, so no `ESCAPE` clause is needed.
 */
function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * The only supported way to build a "contains" ILIKE condition: escapes
 * `term` and wraps it in `%...%`. eslint.config.mjs bans importing `ilike`
 * anywhere else.
 */
export function ilikeContains(column: Parameters<typeof ilike>[0], term: string): SQL {
  return ilike(column, `%${escapeLikePattern(term)}%`);
}

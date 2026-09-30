import { and, eq, exists, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Executor } from '../db/executor';
import { account, bank } from '../db/schema';
import { MemberId } from './ids';

// The accounts a member can reach: theirs, with nothing deleted along the
// bank→account chain. Closed ones stay reachable/listable. Builds its own
// EXISTS subquery against `bank` — usable in any query that has `account`
// in its FROM/JOIN, without the caller also having to join `bank` itself
// (a join a caller could previously forget, silently widening the scope to
// every member's accounts). Takes the same query-builder surface an open
// transaction exposes too, so a caller can run this predicate as part of
// its own transaction instead of a separate connection.
export function reachableAccountsOf(db: NodePgDatabase | Executor, memberId: MemberId) {
  return and(
    eq(account.deleted, false),
    exists(
      db
        .select({ one: sql`1` })
        .from(bank)
        .where(
          and(eq(bank.id, account.bankId), eq(bank.memberId, memberId), eq(bank.deleted, false)),
        ),
    ),
  );
}

// "Fully active" = an account and its bank are both neither closed nor
// deleted — required for a mutation (creating/editing an entry, a transfer
// target, a scheduler occurrence); a merely-closed chain stays
// reachable/listable, see reachableAccountsOf above. Every current caller
// already holds both rows (in memory, or from a query that joined them
// itself), so this stays a plain predicate rather than a second
// query-builder condition alongside reachableAccountsOf — add one only
// once an actual caller needs "fully active" as a WHERE clause.
export function isFullyActive(
  acc: { closed: boolean; deleted: boolean },
  bnk: { closed: boolean; deleted: boolean },
): boolean {
  return !acc.closed && !acc.deleted && !bnk.closed && !bnk.deleted;
}

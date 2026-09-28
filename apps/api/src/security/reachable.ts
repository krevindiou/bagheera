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

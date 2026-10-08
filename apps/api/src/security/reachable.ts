import { and, eq, exists, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Executor } from '../db/executor';
import { account, bank } from '../db/schema';
import { MemberId } from './ids';

// The accounts a member can reach: theirs, nothing deleted along the
// bank→account chain, closed included. Its own EXISTS against `bank` makes
// it correct in any query with `account` in scope, joined to `bank` or not.
// Accepts a transaction too.
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

// Account and bank both neither closed nor deleted: required for any
// mutation (an entry, a transfer target, a scheduler occurrence).
export function isFullyActive(
  acc: { closed: boolean; deleted: boolean },
  bnk: { closed: boolean; deleted: boolean },
): boolean {
  return !acc.closed && !acc.deleted && !bnk.closed && !bnk.deleted;
}

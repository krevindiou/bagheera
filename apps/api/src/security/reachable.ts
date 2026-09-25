import { and, eq } from 'drizzle-orm';
import { account, bank } from '../db/schema';

// The accounts a member can reach: theirs, with nothing deleted along the
// bank→account chain. Closed ones stay reachable/listable. Only valid in a
// query that joins `account` to `bank`.
export function reachableAccountsOf(memberId: string) {
  return and(eq(bank.memberId, memberId), eq(bank.deleted, false), eq(account.deleted, false));
}

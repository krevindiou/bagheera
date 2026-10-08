import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { account, reportAccount } from '../db/schema';
import { MemberId } from '../security/ids';
import { reachableAccountsOf } from '../security/reachable';

export interface EffectiveAccount {
  id: string;
  currency: string;
}

// The accounts feeding a report: its linked ones, or every reachable one
// when none are linked. Deleted ones are excluded either way.
export async function effectiveAccounts(
  db: NodePgDatabase,
  reportId: string,
  memberId: string,
): Promise<EffectiveAccount[]> {
  // "None selected" means no link rows at all — a selection that's been
  // narrowed to nothing by exclusion (e.g. every linked account has since
  // been deleted) does NOT fall back to "all accounts".
  const rawLinks = await db
    .select({ accountId: reportAccount.accountId })
    .from(reportAccount)
    .where(eq(reportAccount.reportId, reportId));

  const reachable = reachableAccountsOf(db, memberId as MemberId);

  if (rawLinks.length === 0) {
    return db.select({ id: account.id, currency: account.currency }).from(account).where(reachable);
  }

  return db
    .select({ id: account.id, currency: account.currency })
    .from(reportAccount)
    .innerJoin(account, eq(reportAccount.accountId, account.id))
    .where(and(eq(reportAccount.reportId, reportId), reachable));
}

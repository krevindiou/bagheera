import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { account, bank, reportAccount } from '../db/schema';

export interface EffectiveAccount {
  id: string;
  currency: string;
}

// Data = the report's linked accounts, or all of the member's eligible
// accounts when none are linked — in both cases, deleted accounts and
// accounts of deleted banks are excluded, including accounts that were
// explicitly selected before being deleted. Shared by every report
// aggregation (report-series.service.ts, report-distribution.service.ts) so the
// "which accounts feed this report" rule lives in exactly one place.
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

  if (rawLinks.length === 0) {
    return db
      .select({ id: account.id, currency: account.currency })
      .from(account)
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(and(eq(bank.memberId, memberId), eq(account.deleted, false), eq(bank.deleted, false)));
  }

  return db
    .select({ id: account.id, currency: account.currency })
    .from(reportAccount)
    .innerJoin(account, eq(reportAccount.accountId, account.id))
    .innerJoin(bank, eq(account.bankId, bank.id))
    .where(
      and(
        eq(reportAccount.reportId, reportId),
        eq(account.deleted, false),
        eq(bank.deleted, false),
      ),
    );
}

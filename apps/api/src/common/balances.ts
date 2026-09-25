import { inArray, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { operation } from '../db/schema';
import { MinorUnits } from './money';

export interface AccountBalance {
  /** Sum of credits minus sum of debits over all the account's operations. */
  balance: MinorUnits;
  /** The same computation restricted to reconciled operations. */
  reconciledBalance: MinorUnits;
}

export const ZERO_BALANCE: AccountBalance = {
  balance: 0 as MinorUnits,
  reconciledBalance: 0 as MinorUnits,
};

// Accounts without any operation are absent from the map — callers fall back
// to ZERO_BALANCE.
export async function balancesByAccount(
  db: NodePgDatabase,
  accountIds: string[],
): Promise<Map<string, AccountBalance>> {
  if (accountIds.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({
      accountId: operation.accountId,
      credit: sql<string>`coalesce(sum(${operation.credit}), 0)`,
      debit: sql<string>`coalesce(sum(${operation.debit}), 0)`,
      reconciledCredit: sql<string>`coalesce(sum(${operation.credit}) filter (where ${operation.reconciled}), 0)`,
      reconciledDebit: sql<string>`coalesce(sum(${operation.debit}) filter (where ${operation.reconciled}), 0)`,
    })
    .from(operation)
    .where(inArray(operation.accountId, accountIds))
    .groupBy(operation.accountId);
  // The aggregates come back as strings from node-postgres, and subtracting
  // them widens to plain `number`, hence the casts on the finished totals.
  return new Map(
    rows.map((row) => [
      row.accountId,
      {
        balance: (Number(row.credit) - Number(row.debit)) as MinorUnits,
        reconciledBalance: (Number(row.reconciledCredit) -
          Number(row.reconciledDebit)) as MinorUnits,
      },
    ]),
  );
}

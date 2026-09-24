import { inArray, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { operation } from '../db/schema';
import { MinorUnits } from './money';
import type { SynthesisChartRow } from './synthesis-chart';

export interface MonthlyNet {
  accountId: string;
  /** First day of the month, 'YYYY-MM-01'. */
  month: string;
  /** Credits minus debits over the month. */
  net: MinorUnits;
}

/**
 * Each account's net movement per calendar month, summed in Postgres. The
 * synthesis charts bucket by month anyway, so this gives them exactly what
 * they'd compute from every operation row, without pulling those rows into
 * Node — one row per account and month instead of one per operation.
 */
export async function monthlyNetByAccount(
  db: NodePgDatabase,
  accountIds: string[],
): Promise<MonthlyNet[]> {
  if (accountIds.length === 0) {
    return [];
  }
  const month = sql<string>`to_char(${operation.valueDate}, 'YYYY-MM') || '-01'`;
  const rows = await db
    .select({
      accountId: operation.accountId,
      month,
      net: sql<string>`sum(coalesce(${operation.credit}, 0) - coalesce(${operation.debit}, 0))`,
    })
    .from(operation)
    .where(inArray(operation.accountId, accountIds))
    .groupBy(operation.accountId, month);
  return rows.map((row) => ({
    accountId: row.accountId,
    month: row.month,
    net: Number(row.net) as MinorUnits,
  }));
}

/** A month's net as the single credit or debit row `computeSynthesisChart` sums. */
export function toSynthesisChartRow(monthly: MonthlyNet, currency: string): SynthesisChartRow {
  return monthly.net >= 0
    ? { currency, credit: monthly.net, debit: null, valueDate: monthly.month }
    : {
        currency,
        credit: null,
        debit: -(monthly.net as number) as MinorUnits,
        valueDate: monthly.month,
      };
}

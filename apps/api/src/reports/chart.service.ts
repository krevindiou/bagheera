import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { AxisBounds, computeAxisBounds } from '../common/chart-axis';
import { ilikeContains } from '../common/like-pattern';
import { toMajorUnits } from '../common/money';
import { DRIZZLE } from '../db/db.constants';
import { account, bank, operation, report, reportAccount } from '../db/schema';
import { fillPeriodGaps } from './chart/period';

export interface ReportChartSeriesPoint {
  period: string;
  value: number;
}

export interface ReportChartSeries {
  currency: string;
  credit: ReportChartSeriesPoint[];
  debit: ReportChartSeriesPoint[];
}

export interface ReportChart {
  hidden: boolean;
  axisBounds: AxisBounds | null;
  series: ReportChartSeries[];
}

interface Bucket {
  debitSum: number;
  debitCount: number;
  creditSum: number;
  creditCount: number;
}

const ALL_PERIOD_KEY = 'all';

// Postgres `date_trunc(field, ...)` field names, one per non-'all' grouping.
// 'all' has no period arithmetic — it is a single aggregate bucket handled
// separately below, without a GROUP BY on period at all.
const DATE_TRUNC_FIELD = {
  month: 'month',
  quarter: 'quarter',
  year: 'year',
} as const;

function currentYearStart(): string {
  return `${new Date().getUTCFullYear()}-01-01`;
}

@Injectable()
export class ReportChartService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  private requireMemberId(req: Request): number {
    const memberId = req.session.memberId;
    if (!memberId) {
      throw new UnauthorizedException();
    }
    return memberId;
  }

  private async findOwnedReport(id: number, memberId: number) {
    const [row] = await this.db.select().from(report).where(eq(report.id, id));
    if (!row || row.memberId !== memberId) {
      throw new NotFoundException();
    }
    return row;
  }

  // Data = the report's linked accounts, or all of the member's eligible
  // accounts when none are linked; in both cases, deleted accounts and
  // accounts of deleted banks are excluded — including accounts that were
  // explicitly selected before being deleted.
  private async effectiveAccounts(
    reportId: number,
    memberId: number,
  ): Promise<{ id: number; currency: string }[]> {
    // "None selected" means no link rows at all — a selection that's been
    // narrowed to nothing by exclusion (e.g. every linked account has
    // since been deleted) does NOT fall back to "all accounts".
    const rawLinks = await this.db
      .select({ accountId: reportAccount.accountId })
      .from(reportAccount)
      .where(eq(reportAccount.reportId, reportId));

    if (rawLinks.length === 0) {
      return this.db
        .select({ id: account.id, currency: account.currency })
        .from(account)
        .innerJoin(bank, eq(account.bankId, bank.id))
        .where(
          and(
            eq(bank.memberId, memberId),
            eq(account.deleted, false),
            eq(bank.deleted, false),
          ),
        );
    }

    return this.db
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

  async getChart(req: Request, id: number): Promise<ReportChart> {
    const memberId = this.requireMemberId(req);
    const rpt = await this.findOwnedReport(id, memberId);
    return this.computeChart(rpt, memberId);
  }

  // Split out from `getChart` so the dashboard's homepage-report section
  // (step 37) can reuse the aggregation for reports it already fetched and
  // owns, without a second ownership round-trip.
  async computeChart(
    rpt: typeof report.$inferSelect,
    memberId: number,
  ): Promise<ReportChart> {
    const accounts = await this.effectiveAccounts(rpt.id, memberId);
    if (accounts.length === 0) {
      return { hidden: true, axisBounds: null, series: [] };
    }

    const conditions = [
      inArray(
        operation.accountId,
        accounts.map((a) => a.id),
      ),
    ];
    if (rpt.valueDateStart) {
      conditions.push(gte(operation.valueDate, rpt.valueDateStart));
    }
    if (rpt.valueDateEnd) {
      conditions.push(lte(operation.valueDate, rpt.valueDateEnd));
    }
    if (rpt.thirdParties) {
      conditions.push(ilikeContains(operation.thirdParty, rpt.thirdParties));
    }
    if (rpt.reconciledOnly) {
      conditions.push(eq(operation.reconciled, true));
    }

    const grouping = rpt.periodGrouping;

    // Period + sum/count aggregation happens in Postgres (GROUP BY +
    // date_trunc), not by streaming every raw operation row into Node and
    // bucketing it in a JS Map — the result set here is one row per
    // currency/period actually present, not one row per operation.
    const periodExpr =
      grouping === 'all'
        ? sql<string | null>`null`
        : sql<string>`date_trunc(${DATE_TRUNC_FIELD[grouping]}, ${operation.valueDate})::date`;

    const aggregated = await this.db
      .select({
        currency: account.currency,
        period: periodExpr.as('period'),
        debitSum: sql<
          string | null
        >`sum(${operation.debit}) filter (where ${operation.debit} is not null)`,
        debitCount: sql<string>`count(${operation.debit})`,
        creditSum: sql<
          string | null
        >`sum(${operation.credit}) filter (where ${operation.credit} is not null)`,
        creditCount: sql<string>`count(${operation.credit})`,
      })
      .from(operation)
      .innerJoin(account, eq(operation.accountId, account.id))
      .where(and(...conditions))
      // GROUP BY the *output column position* (2 = period), not a second
      // rendering of `periodExpr` — Drizzle binds each `sql` usage as its
      // own parameter, so repeating the expression here would give
      // Postgres two `date_trunc($1, ...)` calls referencing different
      // bind params it can't prove are equal, and it rejects the query
      // ("must appear in the GROUP BY clause or be used in an aggregate
      // function"). Ordinal position always refers back to the same
      // already-computed SELECT-list expression. For 'all' grouping,
      // `period` is a constant (`null`), which needs no GROUP BY entry.
      .groupBy(
        ...(grouping === 'all'
          ? [account.currency]
          : [account.currency, sql`2`]),
      );

    const byCurrency = new Map<string, Map<string, Bucket>>();
    for (const row of aggregated) {
      const key = row.period ?? ALL_PERIOD_KEY;
      let periods = byCurrency.get(row.currency);
      if (!periods) {
        periods = new Map();
        byCurrency.set(row.currency, periods);
      }
      periods.set(key, {
        debitSum: row.debitSum === null ? 0 : Number(row.debitSum),
        debitCount: Number(row.debitCount),
        creditSum: row.creditSum === null ? 0 : Number(row.creditSum),
        creditCount: Number(row.creditCount),
      });
    }

    const series: ReportChartSeries[] = [];
    let dataMin = Infinity;
    let dataMax = -Infinity;

    for (const currency of [...byCurrency.keys()].sort()) {
      const periods = byCurrency.get(currency)!;
      const periodKeys =
        grouping === 'all'
          ? [ALL_PERIOD_KEY]
          : fillPeriodGaps(
              [...periods.keys()].sort()[0],
              [...periods.keys()].sort().at(-1)!,
              grouping,
            );

      const credit: ReportChartSeriesPoint[] = [];
      const debit: ReportChartSeriesPoint[] = [];
      for (const key of periodKeys) {
        const bucket = periods.get(key);
        const creditRaw =
          !bucket || bucket.creditCount === 0
            ? 0
            : rpt.type === 'sum'
              ? bucket.creditSum
              : bucket.creditSum / bucket.creditCount;
        const debitRaw =
          !bucket || bucket.debitCount === 0
            ? 0
            : rpt.type === 'sum'
              ? bucket.debitSum
              : bucket.debitSum / bucket.debitCount;
        const creditValue = toMajorUnits(creditRaw);
        const debitValue = toMajorUnits(debitRaw);
        const label = grouping === 'all' ? currentYearStart() : key;
        credit.push({ period: label, value: creditValue });
        debit.push({ period: label, value: debitValue });
        dataMin = Math.min(dataMin, creditValue, debitValue);
        dataMax = Math.max(dataMax, creditValue, debitValue);
      }
      series.push({ currency, credit, debit });
    }

    if (series.length === 0) {
      return { hidden: true, axisBounds: null, series: [] };
    }

    return {
      hidden: false,
      axisBounds: computeAxisBounds(dataMin, dataMax),
      series,
    };
  }
}

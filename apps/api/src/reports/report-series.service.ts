import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AxisBounds, computeAxisBounds } from '../common/chart-axis';
import { MinorUnits, toMajorUnits } from '../common/money';
import { DRIZZLE } from '../db/db.constants';
import { account, operation, report } from '../db/schema';
import { MemberId, ReportId } from '../security/ids';
import { OwnershipService } from '../security/ownership.service';
import { fillPeriodGaps } from './chart/period';
import { effectiveAccounts } from './effective-accounts';
import { effectiveCategoryIds } from './effective-categories';
import { reportOperationConditions } from './report-filters';
import { ALL_PERIOD_KEY, currentYearStart, periodExpr } from './report-periods';

export interface ReportSeriesPoint {
  period: string;
  value: number;
}

export interface ReportSeriesEntry {
  currency: string;
  credit: ReportSeriesPoint[];
  debit: ReportSeriesPoint[];
}

export interface ReportSeries {
  hidden: boolean;
  axisBounds: AxisBounds | null;
  series: ReportSeriesEntry[];
}

interface Bucket {
  debitSum: MinorUnits;
  debitCount: number;
  creditSum: MinorUnits;
  creditCount: number;
}

@Injectable()
export class ReportSeriesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly ownership: OwnershipService,
  ) {}

  async getSeries(memberId: MemberId, id: string): Promise<ReportSeries> {
    const rpt = await this.ownership.requireOwnedReport(id as ReportId, memberId);
    return this.computeSeries(rpt, memberId);
  }

  // Split out from `getSeries` so the dashboard's homepage-report section
  // (step 37) can reuse the aggregation for reports it already fetched and
  // owns, without a second ownership round-trip.
  async computeSeries(rpt: typeof report.$inferSelect, memberId: string): Promise<ReportSeries> {
    const accounts = await effectiveAccounts(this.db, rpt.id, memberId);
    if (accounts.length === 0) {
      return { hidden: true, axisBounds: null, series: [] };
    }

    const categoryIds = await effectiveCategoryIds(this.db, rpt.id);
    const conditions = reportOperationConditions(
      rpt,
      accounts.map((a) => a.id),
      categoryIds,
    );

    const grouping = rpt.periodGrouping;

    // Period + sum/count aggregation happens in Postgres (GROUP BY +
    // date_trunc), not by streaming every raw operation row into Node and
    // bucketing it in a JS Map — the result set here is one row per
    // currency/period actually present, not one row per operation.
    const aggregated = await this.db
      .select({
        currency: account.currency,
        period: periodExpr(operation.valueDate, grouping).as('period'),
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
      .groupBy(...(grouping === 'all' ? [account.currency] : [account.currency, sql`2`]));

    const byCurrency = new Map<string, Map<string, Bucket>>();
    for (const row of aggregated) {
      const key = row.period ?? ALL_PERIOD_KEY;
      let periods = byCurrency.get(row.currency);
      if (!periods) {
        periods = new Map();
        byCurrency.set(row.currency, periods);
      }
      periods.set(key, {
        debitSum: (row.debitSum === null ? 0 : Number(row.debitSum)) as MinorUnits,
        debitCount: Number(row.debitCount),
        creditSum: (row.creditSum === null ? 0 : Number(row.creditSum)) as MinorUnits,
        creditCount: Number(row.creditCount),
      });
    }

    const series: ReportSeriesEntry[] = [];
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

      const credit: ReportSeriesPoint[] = [];
      const debit: ReportSeriesPoint[] = [];
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
        // Both ternaries' non-zero branches are already MinorUnits, but the
        // `0` fallback and the `/ count` average branch each widen back to
        // plain `number` — cast at the finished total, same as elsewhere.
        const creditValue = toMajorUnits(creditRaw as MinorUnits);
        const debitValue = toMajorUnits(debitRaw as MinorUnits);
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

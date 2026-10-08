import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { computeAxisBounds } from '../common/chart-axis';
import { MinorUnits } from '../common/money';
import { DRIZZLE } from '../db/db.constants';
import { account, operation, report } from '../db/schema';
import { MemberId, ReportId } from '../security/ids';
import { OwnershipService } from '../security/ownership.service';
import { fillPeriodGaps } from './chart/period';
import { effectiveAccounts } from './effective-accounts';
import { effectiveCategoryIds } from './effective-categories';
import { reportOperationConditions } from './report-filters';
import { ALL_PERIOD_KEY, currentYearStart, periodExpr } from './report-periods';
import { ChartPointDto } from '../common/dto/chart-response.dto';
import { ReportSeriesDto, ReportSeriesEntryDto } from './dto/report-response.dto';

export type ReportSeriesPoint = ChartPointDto;

export type ReportSeriesEntry = ReportSeriesEntryDto;

export type ReportSeries = ReportSeriesDto;

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

  // For the dashboard, which already holds the owned report.
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

    // Aggregated in Postgres: one row per currency/period, not per operation.
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
      // GROUP BY position 2 (period): repeating `periodExpr` would bind a
      // second parameter Postgres can't prove equal to the SELECT's ("must
      // appear in the GROUP BY clause"). 'all' has a constant period.
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
        // The `0` and average branches widen to `number`.
        const creditValue = creditRaw as MinorUnits;
        const debitValue = debitRaw as MinorUnits;
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

import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { MinorUnits } from '../common/money';
import { DRIZZLE } from '../db/db.constants';
import { account, category, operation, paymentMethod, report } from '../db/schema';
import { MemberId, ReportId } from '../security/ids';
import { OwnershipService } from '../security/ownership.service';
import { fillPeriodGaps } from './chart/period';
import { effectiveAccounts } from './effective-accounts';
import { effectiveCategoryIds } from './effective-categories';
import { reportOperationConditions } from './report-filters';
import { ALL_PERIOD_KEY, currentYearStart, PeriodGrouping, periodExpr } from './report-periods';
import { ChartPointDto } from '../common/dto/chart-response.dto';
import {
  ReportDistributionDto,
  ReportDistributionLabelSeriesDto,
  ReportDistributionSeriesDto,
} from './dto/report-response.dto';

export type ReportDistributionPoint = ChartPointDto;

export type ReportDistributionLabelSeries = ReportDistributionLabelSeriesDto;

export type ReportDistributionSeries = ReportDistributionSeriesDto;

export type ReportDistribution = ReportDistributionDto;

interface GroupedRow {
  currency: string;
  period: string | null;
  label: string | null;
  debitSum: string | null;
  creditSum: string | null;
}

@Injectable()
export class ReportDistributionService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly ownership: OwnershipService,
  ) {}

  async getDistribution(memberId: MemberId, id: string): Promise<ReportDistribution> {
    const rpt = await this.ownership.requireOwnedReport(id as ReportId, memberId);
    return this.computeDistribution(rpt, memberId);
  }

  // For the dashboard, which already holds the owned report.
  async computeDistribution(
    rpt: typeof report.$inferSelect,
    memberId: string,
  ): Promise<ReportDistribution> {
    const accounts = await effectiveAccounts(this.db, rpt.id, memberId);
    if (accounts.length === 0) {
      return { hidden: true, dataGrouping: rpt.dataGrouping!, series: [] };
    }
    const accountIds = accounts.map((a) => a.id);
    const categoryIds = await effectiveCategoryIds(this.db, rpt.id);

    // Required for 'distribution' reports (see CreateReportDto), the only
    // ones reaching this service.
    const limit = rpt.significantResultsNumber!;
    const grouping = rpt.periodGrouping;

    // Pass 1: whole-range totals per (currency, label), only to rank labels
    // and pick each side's top N.
    const totals = await this.groupedRows(rpt, accountIds, categoryIds, 'all');
    const topDebit = new Map<string, Set<string>>();
    const topCredit = new Map<string, Set<string>>();
    for (const currency of new Set(totals.map((row) => row.currency))) {
      const rows = totals.filter((row) => row.currency === currency);
      topDebit.set(currency, topLabels(rows, 'debitSum', limit));
      topCredit.set(currency, topLabels(rows, 'creditSum', limit));
    }

    // Pass 2: per (currency, period, label), reusing pass 1 for 'all'.
    const periodRows =
      grouping === 'all' ? totals : await this.groupedRows(rpt, accountIds, categoryIds, grouping);

    // currency -> side -> label (null = Other) -> period -> minor-units sum
    const byCurrency = new Map<
      string,
      {
        debit: Map<string | null, Map<string, MinorUnits>>;
        credit: Map<string | null, Map<string, MinorUnits>>;
      }
    >();
    const periodsByCurrency = new Map<string, Set<string>>();

    for (const row of periodRows) {
      const periodKey = row.period ?? ALL_PERIOD_KEY;
      let entry = byCurrency.get(row.currency);
      if (!entry) {
        entry = { debit: new Map(), credit: new Map() };
        byCurrency.set(row.currency, entry);
      }
      let periods = periodsByCurrency.get(row.currency);
      if (!periods) {
        periods = new Set();
        periodsByCurrency.set(row.currency, periods);
      }
      periods.add(periodKey);

      if (row.debitSum !== null) {
        addAmount(
          entry.debit,
          resolveLabel(row.label, topDebit.get(row.currency)!),
          periodKey,
          Number(row.debitSum) as MinorUnits,
        );
      }
      if (row.creditSum !== null) {
        addAmount(
          entry.credit,
          resolveLabel(row.label, topCredit.get(row.currency)!),
          periodKey,
          Number(row.creditSum) as MinorUnits,
        );
      }
    }

    const series: ReportDistributionSeries[] = [];
    for (const currency of [...byCurrency.keys()].sort()) {
      const entry = byCurrency.get(currency)!;
      const presentPeriods = [...periodsByCurrency.get(currency)!].sort();
      const periodKeys =
        grouping === 'all'
          ? [ALL_PERIOD_KEY]
          : fillPeriodGaps(presentPeriods[0], presentPeriods.at(-1)!, grouping);

      const debit = assembleLabelSeries(entry.debit, periodKeys, grouping, topDebit.get(currency)!);
      const credit = assembleLabelSeries(
        entry.credit,
        periodKeys,
        grouping,
        topCredit.get(currency)!,
      );
      if (debit.length > 0 || credit.length > 0) {
        series.push({ currency, debit, credit });
      }
    }

    return { hidden: series.length === 0, dataGrouping: rpt.dataGrouping!, series };
  }

  // Aggregated in Postgres: one row per currency/period/label. Three
  // branches because the join differs per dataGrouping, which drizzle's
  // types don't express as one conditional query.
  private async groupedRows(
    rpt: typeof report.$inferSelect,
    accountIds: string[],
    categoryIds: string[],
    grouping: PeriodGrouping,
  ): Promise<GroupedRow[]> {
    const conditions = reportOperationConditions(rpt, accountIds, categoryIds);
    const period = periodExpr(operation.valueDate, grouping).as('period');
    const debitSum = sql<
      string | null
    >`sum(${operation.debit}) filter (where ${operation.debit} is not null)`;
    const creditSum = sql<
      string | null
    >`sum(${operation.credit}) filter (where ${operation.credit} is not null)`;
    // GROUP BY position 2 (period), as in report-series.service.ts.
    const periodGroupBy = grouping === 'all' ? [] : [sql`2`];

    switch (rpt.dataGrouping) {
      case 'category':
        return this.db
          .select({ currency: account.currency, period, label: category.name, debitSum, creditSum })
          .from(operation)
          .innerJoin(account, eq(operation.accountId, account.id))
          .leftJoin(category, eq(operation.categoryId, category.id))
          .where(and(...conditions))
          .groupBy(account.currency, ...periodGroupBy, category.name);

      case 'payment_method':
        return this.db
          .select({
            currency: account.currency,
            period,
            label: paymentMethod.name,
            debitSum,
            creditSum,
          })
          .from(operation)
          .innerJoin(account, eq(operation.accountId, account.id))
          .innerJoin(paymentMethod, eq(operation.paymentMethodId, paymentMethod.id))
          .where(and(...conditions))
          .groupBy(account.currency, ...periodGroupBy, paymentMethod.name);

      case 'third_party':
      default:
        return this.db
          .select({
            currency: account.currency,
            period,
            label: operation.thirdParty,
            debitSum,
            creditSum,
          })
          .from(operation)
          .innerJoin(account, eq(operation.accountId, account.id))
          .where(and(...conditions))
          .groupBy(account.currency, ...periodGroupBy, operation.thirdParty);
    }
  }
}

// The top `limit` non-null labels by whole-range total, ranked desc (ties
// broken by label for determinism) — a null label (uncategorized) never
// makes the cut, so it always folds into "Other" regardless of its size,
// same as the ranked tail.
function topLabels(
  rows: GroupedRow[],
  sumKey: 'debitSum' | 'creditSum',
  limit: number,
): Set<string> {
  const named = rows
    .filter((row) => row.label !== null && row[sumKey] !== null)
    .map((row) => ({ label: row.label as string, value: Number(row[sumKey]) }))
    .sort((a, b) => (b.value !== a.value ? b.value - a.value : a.label.localeCompare(b.label)));
  return new Set(named.slice(0, limit).map((entry) => entry.label));
}

function resolveLabel(label: string | null, topSet: Set<string>): string | null {
  return label !== null && topSet.has(label) ? label : null;
}

function addAmount(
  bySide: Map<string | null, Map<string, MinorUnits>>,
  label: string | null,
  period: string,
  value: MinorUnits,
): void {
  let periods = bySide.get(label);
  if (!periods) {
    periods = new Map();
    bySide.set(label, periods);
  }
  periods.set(period, ((periods.get(period) ?? 0) + value) as MinorUnits);
}

// One series per label, in rank order (topSet's insertion order), "Other"
// last, each zero-filled over `periodKeys` so stacked series share an axis.
function assembleLabelSeries(
  bySide: Map<string | null, Map<string, MinorUnits>>,
  periodKeys: string[],
  grouping: PeriodGrouping,
  topSet: Set<string>,
): ReportDistributionLabelSeries[] {
  const labelsInOrder: (string | null)[] = [...topSet, ...(bySide.has(null) ? [null] : [])];
  const series: ReportDistributionLabelSeries[] = [];
  for (const label of labelsInOrder) {
    const periods = bySide.get(label);
    if (!periods) continue;
    const points = periodKeys.map((key) => ({
      period: grouping === 'all' ? currentYearStart() : key,
      value: (periods.get(key) ?? 0) as MinorUnits,
    }));
    series.push({ label, points });
  }
  return series;
}

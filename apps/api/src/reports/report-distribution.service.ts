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

export interface ReportDistributionPoint {
  period: string;
  value: number;
}

export interface ReportDistributionLabelSeries {
  // null = the collapsed "Other" bucket: the ranked tail past the top N,
  // plus any uncategorized operations. The top-N label set is ranked once
  // over the report's *whole* date range and then held fixed across every
  // period — so with a month/quarter/year periodGrouping, a stacked chart's
  // segments never appear, disappear, or reorder from one period to the
  // next depending on which period happens to be looked at.
  label: string | null;
  points: ReportDistributionPoint[];
}

export interface ReportDistributionSeries {
  currency: string;
  debit: ReportDistributionLabelSeries[];
  credit: ReportDistributionLabelSeries[];
}

export interface ReportDistribution {
  hidden: boolean;
  dataGrouping: 'category' | 'third_party' | 'payment_method';
  series: ReportDistributionSeries[];
}

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

  // Split out from `getDistribution` so the dashboard's homepage-report
  // section can reuse the aggregation for reports it already fetched and
  // owns, without a second ownership round-trip — same split as
  // ReportSeriesService.computeSeries.
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

    // Only 'distribution' reports reach this service — dataGrouping and
    // significantResultsNumber are both required for it (see
    // CreateReportDto's conditional validation), so they're never null
    // here despite the columns themselves being nullable.
    const limit = rpt.significantResultsNumber!;
    const grouping = rpt.periodGrouping;

    // Pass 1: whole-range totals per (currency, label) — 'all' grouping
    // regardless of the report's own periodGrouping — used only to rank
    // labels and fix the top-N set each side keeps as its own series.
    const totals = await this.groupedRows(rpt, accountIds, categoryIds, 'all');
    const topDebit = new Map<string, Set<string>>();
    const topCredit = new Map<string, Set<string>>();
    for (const currency of new Set(totals.map((row) => row.currency))) {
      const rows = totals.filter((row) => row.currency === currency);
      topDebit.set(currency, topLabels(rows, 'debitSum', limit));
      topCredit.set(currency, topLabels(rows, 'creditSum', limit));
    }

    // Pass 2: per (currency, period, label) breakdown, at the report's own
    // periodGrouping — reuses pass 1's rows outright when that grouping is
    // itself 'all' rather than issuing an identical query twice.
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

  // Grouping + sum aggregation happens in Postgres (GROUP BY on the
  // resolved label column, plus period when requested), not by streaming
  // every raw operation row into Node — the result set here is one row per
  // currency/period/label actually present, not one row per operation.
  // Three near-identical branches rather than one dynamically-joined
  // query: the join (or lack of one) differs per dataGrouping, and
  // drizzle's query builder doesn't thread a conditional join through its
  // return type cleanly.
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
    // GROUP BY the *output column position* (2 = period) rather than a
    // second rendering of the date_trunc expression — see
    // report-series.service.ts's computeSeries for why repeating it would
    // make Postgres reject the query. The label column, unlike period, is a
    // plain column reference (no bind params to duplicate), so it's grouped
    // by directly.
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

// Assembles one series per label present, in rank order (topSet's insertion
// order is its whole-range rank, since it was built from an already-sorted
// list), with "Other" last when present — each with a zero-filled point per
// `periodKeys`, so every series in a stacked chart shares the same period
// axis even where a given label had no activity in some period.
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

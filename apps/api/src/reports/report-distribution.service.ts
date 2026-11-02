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
import type { PeriodGrouping } from '@bagheera/reference-data';
import { ALL_PERIOD_KEY, currentYearStart, periodExpr } from './report-periods';
import {
  ReportDistributionDto,
  ReportDistributionLabelSeriesDto,
  ReportDistributionSeriesDto,
} from './dto/report-response.dto';

export type ReportDistributionLabelSeries = ReportDistributionLabelSeriesDto;

export type ReportDistributionSeries = ReportDistributionSeriesDto;

export type ReportDistribution = ReportDistributionDto;

type Side = 'debit' | 'credit';

// One row per currency/period/side and label, the ranked tail already folded
// into Other (`label` and `rank` null), so at most `limit + 1` per bucket.
type RankedRow = {
  currency: string;
  period: string | null;
  side: Side;
  label: string | null;
  rank: number | null;
  amount: string;
};

// Labels are ranked by whole-range total, desc, ties by label under ICU's
// root collation — the order `localeCompare` gives, not the database's own.
const LABEL_TIE_BREAK = sql.raw('collate "und-x-icu"');

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
    const rows = await this.rankedRows(rpt, accountIds, categoryIds, grouping, limit);

    // currency -> side -> label (null = Other) -> period -> minor-units sum
    const byCurrency = new Map<
      string,
      Record<
        Side,
        { ranks: Map<string, number>; amounts: Map<string | null, Map<string, MinorUnits>> }
      >
    >();
    const periodsByCurrency = new Map<string, Set<string>>();

    for (const row of rows) {
      const periodKey = row.period ?? ALL_PERIOD_KEY;
      let entry = byCurrency.get(row.currency);
      if (!entry) {
        entry = {
          debit: { ranks: new Map(), amounts: new Map() },
          credit: { ranks: new Map(), amounts: new Map() },
        };
        byCurrency.set(row.currency, entry);
      }
      let periods = periodsByCurrency.get(row.currency);
      if (!periods) {
        periods = new Set();
        periodsByCurrency.set(row.currency, periods);
      }
      periods.add(periodKey);

      const side = entry[row.side];
      if (row.label !== null && row.rank !== null) {
        side.ranks.set(row.label, row.rank);
      }
      addAmount(side.amounts, row.label, periodKey, Number(row.amount) as MinorUnits);
    }

    const series: ReportDistributionSeries[] = [];
    for (const currency of [...byCurrency.keys()].sort()) {
      const entry = byCurrency.get(currency)!;
      const presentPeriods = [...periodsByCurrency.get(currency)!].sort();
      const periodKeys =
        grouping === 'all'
          ? [ALL_PERIOD_KEY]
          : fillPeriodGaps(presentPeriods[0], presentPeriods.at(-1)!, grouping);

      const [debit, credit] = (['debit', 'credit'] as const).map((side) =>
        assembleLabelSeries(
          entry[side].amounts,
          periodKeys,
          grouping,
          [...entry[side].ranks].sort((a, b) => a[1] - b[1]).map(([label]) => label),
        ),
      );
      if (debit.length > 0 || credit.length > 0) {
        series.push({ currency, debit, credit });
      }
    }

    return { hidden: series.length === 0, dataGrouping: rpt.dataGrouping!, series };
  }

  // Ranked and capped in Postgres, so the API never holds one row per label:
  // each side's top `limit` non-null labels by whole-range total keep their
  // own rows, and every other label — a null one (uncategorized) included,
  // whatever its size — sums into Other. The top set is fixed over the whole
  // range, not re-ranked per period.
  private async rankedRows(
    rpt: typeof report.$inferSelect,
    accountIds: string[],
    categoryIds: string[],
    grouping: PeriodGrouping,
    limit: number,
  ): Promise<RankedRow[]> {
    const base = this.groupedRows(rpt, accountIds, categoryIds, grouping);
    const result = await this.db.execute<RankedRow>(sql`
      with base as (${base.getSQL()}),
      ranked as (
        select currency, label,
          case when sum(debit_sum) is not null then row_number() over (
            partition by currency
            order by sum(debit_sum) desc nulls last, label ${LABEL_TIE_BREAK}
          ) end as debit_rank,
          case when sum(credit_sum) is not null then row_number() over (
            partition by currency
            order by sum(credit_sum) desc nulls last, label ${LABEL_TIE_BREAK}
          ) end as credit_rank
        from base
        where label is not null
        group by currency, label
      )
      select b.currency, to_char(b.period::date, 'YYYY-MM-DD') as period, 'debit' as side,
        r.label, r.debit_rank::int as rank, sum(b.debit_sum)::text as amount
      from base b
      left join ranked r
        on r.currency = b.currency and r.label = b.label and r.debit_rank <= ${limit}
      where b.debit_sum is not null
      group by b.currency, b.period, r.label, r.debit_rank
      union all
      select b.currency, to_char(b.period::date, 'YYYY-MM-DD'), 'credit',
        r.label, r.credit_rank::int, sum(b.credit_sum)::text
      from base b
      left join ranked r
        on r.currency = b.currency and r.label = b.label and r.credit_rank <= ${limit}
      where b.credit_sum is not null
      group by b.currency, b.period, r.label, r.credit_rank`);
    return result.rows;
  }

  // Aggregated in Postgres: one row per currency/period/label, only ever
  // read by `rankedRows`. Three branches because the join differs per
  // dataGrouping, which drizzle's types don't express as one conditional
  // query.
  private groupedRows(
    rpt: typeof report.$inferSelect,
    accountIds: string[],
    categoryIds: string[],
    grouping: PeriodGrouping,
  ) {
    const conditions = reportOperationConditions(rpt, accountIds, categoryIds);
    const columns = {
      currency: sql<string>`${account.currency}`.as('currency'),
      period: periodExpr(operation.valueDate, grouping).as('period'),
      debitSum: sql<
        string | null
      >`sum(${operation.debit}) filter (where ${operation.debit} is not null)`.as('debit_sum'),
      creditSum: sql<
        string | null
      >`sum(${operation.credit}) filter (where ${operation.credit} is not null)`.as('credit_sum'),
    };
    // GROUP BY position 2 (period), as in report-series.service.ts.
    const periodGroupBy = grouping === 'all' ? [] : [sql`2`];

    switch (rpt.dataGrouping) {
      case 'category':
        return this.db
          .select({ ...columns, label: sql<string | null>`${category.name}`.as('label') })
          .from(operation)
          .innerJoin(account, eq(operation.accountId, account.id))
          .leftJoin(category, eq(operation.categoryId, category.id))
          .where(and(...conditions))
          .groupBy(account.currency, ...periodGroupBy, category.name);

      case 'payment_method':
        return this.db
          .select({ ...columns, label: sql<string | null>`${paymentMethod.name}`.as('label') })
          .from(operation)
          .innerJoin(account, eq(operation.accountId, account.id))
          .innerJoin(paymentMethod, eq(operation.paymentMethodId, paymentMethod.id))
          .where(and(...conditions))
          .groupBy(account.currency, ...periodGroupBy, paymentMethod.name);

      case 'third_party':
      default:
        return this.db
          .select({ ...columns, label: sql<string | null>`${operation.thirdParty}`.as('label') })
          .from(operation)
          .innerJoin(account, eq(operation.accountId, account.id))
          .where(and(...conditions))
          .groupBy(account.currency, ...periodGroupBy, operation.thirdParty);
    }
  }
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

// One series per label, in rank order, "Other" last, each zero-filled over
// `periodKeys` so stacked series share an axis.
function assembleLabelSeries(
  bySide: Map<string | null, Map<string, MinorUnits>>,
  periodKeys: string[],
  grouping: PeriodGrouping,
  ranked: string[],
): ReportDistributionLabelSeries[] {
  const labelsInOrder: (string | null)[] = [...ranked, ...(bySide.has(null) ? [null] : [])];
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

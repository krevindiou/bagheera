import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq, gte, ilike, inArray, lte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { AxisBounds, computeAxisBounds } from '../common/chart-axis';
import { toMajorUnits } from '../common/money';
import { DRIZZLE } from '../db/db.constants';
import { account, bank, operation, report, reportAccount } from '../db/schema';
import { fillPeriodGaps, periodStart } from './chart/period';

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

function emptyBucket(): Bucket {
  return { debitSum: 0, debitCount: 0, creditSum: 0, creditCount: 0 };
}

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

    const currencyByAccount = new Map(
      accounts.map((a) => [a.id, a.currency] as const),
    );
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
      conditions.push(ilike(operation.thirdParty, `%${rpt.thirdParties}%`));
    }
    if (rpt.reconciledOnly) {
      conditions.push(eq(operation.reconciled, true));
    }

    const rows = await this.db
      .select({
        accountId: operation.accountId,
        debit: operation.debit,
        credit: operation.credit,
        valueDate: operation.valueDate,
      })
      .from(operation)
      .where(and(...conditions));

    const grouping = rpt.periodGrouping;
    const byCurrency = new Map<string, Map<string, Bucket>>();

    for (const row of rows) {
      const currency = currencyByAccount.get(row.accountId);
      if (!currency) {
        continue;
      }
      const key =
        grouping === 'all'
          ? ALL_PERIOD_KEY
          : periodStart(row.valueDate, grouping);
      let periods = byCurrency.get(currency);
      if (!periods) {
        periods = new Map();
        byCurrency.set(currency, periods);
      }
      let bucket = periods.get(key);
      if (!bucket) {
        bucket = emptyBucket();
        periods.set(key, bucket);
      }
      if (row.debit !== null) {
        bucket.debitSum += row.debit;
        bucket.debitCount += 1;
      }
      if (row.credit !== null) {
        bucket.creditSum += row.credit;
        bucket.creditCount += 1;
      }
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

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { toMajorUnits } from '../common/money';
import {
  computeSynthesisChart,
  SynthesisChart,
} from '../common/synthesis-chart';
import { DRIZZLE } from '../db/db.constants';
import { account, bank, category, operation, report } from '../db/schema';
import { ReportChart, ReportChartService } from '../reports/chart.service';

export type OnboardingTip = 'no-bank' | 'no-account' | null;

export interface TotalBalance {
  currency: string;
  amount: number;
}

export interface DashboardIndicator {
  amount: number;
  currency: string;
  valueDate: string;
}

export interface AccountsOverviewBank {
  id: number;
  name: string;
  accounts: { id: number; name: string; currency: string; balance: number }[];
}

export interface HomepageReportChart {
  id: number;
  title: string;
  chart: ReportChart;
}

export interface DashboardResponse {
  onboarding: OnboardingTip;
  totalBalances: TotalBalance[];
  lastSalary: DashboardIndicator | null;
  lastBiggestExpense: DashboardIndicator | null;
  synthesisChart: SynthesisChart;
  accountsOverview: AccountsOverviewBank[];
  homepageReports: HomepageReportChart[];
}

const EMPTY_SYNTHESIS_CHART: SynthesisChart = {
  hidden: true,
  axisBounds: null,
  series: [],
};

function previousCalendarMonthRange(): { start: string; end: string } {
  const now = new Date();
  const firstOfCurrentMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const start = new Date(
    Date.UTC(
      firstOfCurrentMonth.getUTCFullYear(),
      firstOfCurrentMonth.getUTCMonth() - 1,
      1,
    ),
  );
  const end = new Date(
    Date.UTC(
      firstOfCurrentMonth.getUTCFullYear(),
      firstOfCurrentMonth.getUTCMonth(),
      0,
    ),
  );
  return { start: isoDate(start), end: isoDate(end) };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly reportCharts: ReportChartService,
    private readonly config: ConfigService,
  ) {}

  private requireMemberId(req: Request): number {
    const memberId = req.session.memberId;
    if (!memberId) {
      throw new UnauthorizedException();
    }
    return memberId;
  }

  private async balancesByAccount(
    accountIds: number[],
  ): Promise<Map<number, number>> {
    if (accountIds.length === 0) {
      return new Map();
    }
    const rows = await this.db
      .select({
        accountId: operation.accountId,
        credit: sql<string>`coalesce(sum(${operation.credit}), 0)`,
        debit: sql<string>`coalesce(sum(${operation.debit}), 0)`,
      })
      .from(operation)
      .where(inArray(operation.accountId, accountIds))
      .groupBy(operation.accountId);
    return new Map(
      rows.map((row) => [
        row.accountId,
        Number(row.credit) - Number(row.debit),
      ]),
    );
  }

  async getDashboard(req: Request): Promise<DashboardResponse> {
    const memberId = this.requireMemberId(req);

    const banks = await this.db
      .select()
      .from(bank)
      .where(and(eq(bank.memberId, memberId), eq(bank.deleted, false)));
    if (banks.length === 0) {
      return {
        onboarding: 'no-bank',
        totalBalances: [],
        lastSalary: null,
        lastBiggestExpense: null,
        synthesisChart: EMPTY_SYNTHESIS_CHART,
        accountsOverview: [],
        homepageReports: [],
      };
    }

    const bankIds = banks.map((b) => b.id);
    const hasActiveBank = banks.some((b) => !b.closed);
    const accounts = await this.db
      .select()
      .from(account)
      .where(and(inArray(account.bankId, bankIds), eq(account.deleted, false)));

    const onboarding: OnboardingTip =
      accounts.length === 0 && hasActiveBank ? 'no-account' : null;

    const balances = await this.balancesByAccount(accounts.map((a) => a.id));

    // Total balance per currency — closed accounts/banks count here, only
    // deleted ones are excluded; ordered by the raw stored integer sum,
    // largest first, no currency conversion across the tie-break.
    const rawTotals = new Map<string, number>();
    for (const acc of accounts) {
      const balance = balances.get(acc.id) ?? 0;
      rawTotals.set(acc.currency, (rawTotals.get(acc.currency) ?? 0) + balance);
    }
    const totalBalances: TotalBalance[] = [...rawTotals.entries()]
      .sort(([currencyA, a], [currencyB, b]) =>
        b !== a ? b - a : currencyA.localeCompare(currencyB),
      )
      .map(([currency, amount]) => ({
        currency,
        amount: toMajorUnits(amount),
      }));

    // "Fully active" scope — the bank itself must also be non-closed.
    const activeBankIds = new Set(
      banks.filter((b) => !b.closed).map((b) => b.id),
    );
    const fullyActiveAccountIds = accounts
      .filter((a) => !a.closed && activeBankIds.has(a.bankId))
      .map((a) => a.id);

    const [lastSalary, lastBiggestExpense, synthesisChart] = await Promise.all([
      this.getLastSalary(fullyActiveAccountIds, accounts),
      this.getLastBiggestExpense(fullyActiveAccountIds, accounts),
      this.getSynthesisChart(accounts),
    ]);

    const accountsOverview: AccountsOverviewBank[] = banks
      .filter((b) => !b.closed)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((b) => ({
        id: b.id,
        name: b.name,
        accounts: accounts
          .filter((a) => a.bankId === b.id && !a.closed)
          .sort((a, b2) => a.name.localeCompare(b2.name))
          .map((a) => ({
            id: a.id,
            name: a.name,
            currency: a.currency,
            balance: toMajorUnits(balances.get(a.id) ?? 0),
          })),
      }));

    const homepageReports = await this.getHomepageReports(memberId);

    return {
      onboarding,
      totalBalances,
      lastSalary,
      lastBiggestExpense,
      synthesisChart,
      accountsOverview,
      homepageReports,
    };
  }

  // Cumulative end-of-month balance, last 12 months, one line per
  // currency — scoped to the same non-deleted-bank/non-deleted-account set
  // as `accounts` above (closed included, deleted excluded, per 2.3).
  private async getSynthesisChart(
    accounts: (typeof account.$inferSelect)[],
  ): Promise<SynthesisChart> {
    if (accounts.length === 0) {
      return EMPTY_SYNTHESIS_CHART;
    }
    const currencyByAccount = new Map(
      accounts.map((a) => [a.id, a.currency] as const),
    );
    const rows = await this.db
      .select({
        accountId: operation.accountId,
        debit: operation.debit,
        credit: operation.credit,
        valueDate: operation.valueDate,
      })
      .from(operation)
      .where(
        inArray(
          operation.accountId,
          accounts.map((a) => a.id),
        ),
      );
    return computeSynthesisChart(
      rows.map((row) => ({
        debit: row.debit,
        credit: row.credit,
        valueDate: row.valueDate,
        currency: currencyByAccount.get(row.accountId)!,
      })),
    );
  }

  private async getLastSalary(
    fullyActiveAccountIds: number[],
    accounts: (typeof account.$inferSelect)[],
  ): Promise<DashboardIndicator | null> {
    if (fullyActiveAccountIds.length === 0) {
      return null;
    }
    const salaryCategoryId = this.config.get<string>('SALARY_CATEGORY_ID', '1');
    const [salaryCategory] = await this.db
      .select()
      .from(category)
      .where(eq(category.id, Number(salaryCategoryId)));
    if (!salaryCategory) {
      return null;
    }

    const [row] = await this.db
      .select()
      .from(operation)
      .where(
        and(
          inArray(operation.accountId, fullyActiveAccountIds),
          eq(operation.categoryId, salaryCategory.id),
        ),
      )
      .orderBy(desc(operation.valueDate), desc(operation.id))
      .limit(1);
    if (!row || row.credit === null) {
      return null;
    }
    const currency = accounts.find((a) => a.id === row.accountId)!.currency;
    return {
      amount: toMajorUnits(row.credit),
      currency,
      valueDate: row.valueDate,
    };
  }

  private async getLastBiggestExpense(
    fullyActiveAccountIds: number[],
    accounts: (typeof account.$inferSelect)[],
  ): Promise<DashboardIndicator | null> {
    if (fullyActiveAccountIds.length === 0) {
      return null;
    }
    const { start, end } = previousCalendarMonthRange();

    const rows = await this.db
      .select()
      .from(operation)
      .where(
        and(
          inArray(operation.accountId, fullyActiveAccountIds),
          isNull(operation.schedulerId),
          sql`${operation.debit} is not null`,
          sql`${operation.valueDate} >= ${start}`,
          sql`${operation.valueDate} <= ${end}`,
        ),
      );
    if (rows.length === 0) {
      return null;
    }

    // Largest raw stored (minor-unit) amount wins, no currency conversion;
    // deterministic tie-break by operation id.
    const winner = rows.sort((a, b) =>
      b.debit! !== a.debit! ? b.debit! - a.debit! : a.id - b.id,
    )[0];
    const currency = accounts.find((a) => a.id === winner.accountId)!.currency;
    return {
      amount: toMajorUnits(winner.debit!),
      currency,
      valueDate: winner.valueDate,
    };
  }

  private async getHomepageReports(
    memberId: number,
  ): Promise<HomepageReportChart[]> {
    const homepageReports = await this.db
      .select()
      .from(report)
      .where(and(eq(report.memberId, memberId), eq(report.homepage, true)));

    const charts = await Promise.all(
      homepageReports.map(async (rpt) => ({
        id: rpt.id,
        title: rpt.title,
        chart: await this.reportCharts.computeChart(rpt, memberId),
      })),
    );
    // A homepage report whose chart has zero data points is omitted.
    return charts.filter((entry) => !entry.chart.hidden);
  }
}

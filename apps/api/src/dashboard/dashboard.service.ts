import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { toMajorUnits } from '../common/money';
import {
  computeSynthesisChart,
  latestValueDate,
  parseSynthesisChartWindow,
  SynthesisChart,
} from '../common/synthesis-chart';
import { DRIZZLE } from '../db/db.constants';
import { account, bank, category, operation, report } from '../db/schema';
import { SALARY_CATEGORY_SEED_ID } from '../db/seed-data';
import { MinorUnits } from '../common/money';
import { ReportChart, ReportChartService } from '../reports/chart.service';
import { requireMemberId } from '../session/require-member-id';

export type OnboardingTip = 'no-bank' | 'no-account' | null;

export interface TotalBalance {
  currency: string;
  amount: number;
  reconciledAmount: number;
}

export interface DashboardIndicator {
  amount: number;
  currency: string;
  valueDate: string;
}

export interface AccountsOverviewBank {
  id: string;
  name: string;
  accounts: {
    id: string;
    name: string;
    currency: string;
    balance: number;
    reconciledBalance: number;
    // Cumulative end-of-month balance, oldest first, for the tile's
    // minimalist sparkline — see `accountHistories` below. Empty when the
    // account has no operations at all.
    history: number[];
  }[];
}

export interface HomepageReportChart {
  id: string;
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

// Sparkline tiles show only a short recent window — a fraction of the
// synthesis chart's full 12-month one — since they carry no axis/labels to
// orient a longer history against.
const SPARKLINE_MONTHS = 6;

const EMPTY_SYNTHESIS_CHART: SynthesisChart = {
  hidden: true,
  axisBounds: null,
  series: [],
};

function previousCalendarMonthRange(): { start: string; end: string } {
  const now = new Date();
  const firstOfCurrentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(
    Date.UTC(firstOfCurrentMonth.getUTCFullYear(), firstOfCurrentMonth.getUTCMonth() - 1, 1),
  );
  const end = new Date(
    Date.UTC(firstOfCurrentMonth.getUTCFullYear(), firstOfCurrentMonth.getUTCMonth(), 0),
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

  private async balancesByAccount(
    accountIds: string[],
  ): Promise<Map<string, { balance: MinorUnits; reconciledBalance: MinorUnits }>> {
    if (accountIds.length === 0) {
      return new Map();
    }
    const rows = await this.db
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

  // Per-account cumulative balance history, last `SPARKLINE_MONTHS` months —
  // one `computeSynthesisChart` call per account (reusing the exact same
  // per-account scoping AccountService.chart uses for the full 12-month
  // chart, including that each account's own window ends at its own latest
  // operation, not today), just trimmed to a shorter trailing window for
  // the tile sparkline. A single query fetches every account's operations
  // up front so this stays one round trip regardless of account count.
  private async accountHistories(
    accounts: (typeof account.$inferSelect)[],
  ): Promise<Map<string, number[]>> {
    const histories = new Map<string, number[]>();
    if (accounts.length === 0) {
      return histories;
    }
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

    const rowsByAccount = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = rowsByAccount.get(row.accountId);
      if (list) {
        list.push(row);
      } else {
        rowsByAccount.set(row.accountId, [row]);
      }
    }

    for (const acc of accounts) {
      const accRows = rowsByAccount.get(acc.id);
      if (!accRows) {
        histories.set(acc.id, []);
        continue;
      }
      const synthesis = computeSynthesisChart(
        accRows.map((row) => ({
          debit: row.debit,
          credit: row.credit,
          valueDate: row.valueDate,
          currency: acc.currency,
        })),
        latestValueDate(accRows),
      );
      const points = synthesis.series[0]?.points ?? [];
      histories.set(
        acc.id,
        points.slice(-SPARKLINE_MONTHS).map((p) => p.value),
      );
    }
    return histories;
  }

  async getDashboard(req: Request, range?: string): Promise<DashboardResponse> {
    const memberId = requireMemberId(req);

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

    const onboarding: OnboardingTip = accounts.length === 0 && hasActiveBank ? 'no-account' : null;

    const balances = await this.balancesByAccount(accounts.map((a) => a.id));

    // Total balance per currency — closed accounts/banks count here, only
    // deleted ones are excluded; ordered by the raw stored integer sum,
    // largest first, no currency conversion across the tie-break. The
    // reconciled total is the same sum restricted to reconciled operations
    // (see AccountService.balance's identical per-account computation).
    const rawTotals = new Map<string, number>();
    const rawReconciledTotals = new Map<string, number>();
    for (const acc of accounts) {
      const entry = balances.get(acc.id);
      const balance = entry?.balance ?? 0;
      const reconciledBalance = entry?.reconciledBalance ?? 0;
      rawTotals.set(acc.currency, (rawTotals.get(acc.currency) ?? 0) + balance);
      rawReconciledTotals.set(
        acc.currency,
        (rawReconciledTotals.get(acc.currency) ?? 0) + reconciledBalance,
      );
    }
    const totalBalances: TotalBalance[] = [...rawTotals.entries()]
      .sort(([currencyA, a], [currencyB, b]) =>
        b !== a ? b - a : currencyA.localeCompare(currencyB),
      )
      .map(([currency, amount]) => ({
        currency,
        // `amount` came from rawTotals, a plain-number accumulator — see
        // the comment on synthesis-chart.ts's `running` for why `+=`
        // always drops the brand even though every addend was MinorUnits.
        amount: toMajorUnits(amount as MinorUnits),
        reconciledAmount: toMajorUnits((rawReconciledTotals.get(currency) ?? 0) as MinorUnits),
      }));

    // "Fully active" scope — the bank itself must also be non-closed.
    const activeBankIds = new Set(banks.filter((b) => !b.closed).map((b) => b.id));
    const fullyActiveAccountIds = accounts
      .filter((a) => !a.closed && activeBankIds.has(a.bankId))
      .map((a) => a.id);

    const [lastSalary, lastBiggestExpense, synthesisChart, histories] = await Promise.all([
      this.getLastSalary(fullyActiveAccountIds, accounts),
      this.getLastBiggestExpense(fullyActiveAccountIds, accounts),
      this.getSynthesisChart(accounts, range),
      this.accountHistories(accounts),
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
            // The `?? 0` fallback is an unbranded literal, so the whole
            // expression reads as plain `number` even on the found-in-map
            // branch.
            balance: toMajorUnits((balances.get(a.id)?.balance ?? 0) as MinorUnits),
            reconciledBalance: toMajorUnits(
              (balances.get(a.id)?.reconciledBalance ?? 0) as MinorUnits,
            ),
            history: histories.get(a.id) ?? [],
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

  // Cumulative end-of-month balance, one line per currency, over a
  // trailing window (12/24 months, or the full history — see `range`) —
  // scoped to the same non-deleted-bank/non-deleted-account set as
  // `accounts` above (closed included, deleted excluded, per 2.3). The
  // window ends at the latest operation across every account in scope, not
  // today (see synthesis-chart.ts's `latestValueDate`) — one shared end
  // date for the whole chart, since every series must share the same
  // period labels.
  private async getSynthesisChart(
    accounts: (typeof account.$inferSelect)[],
    range?: string,
  ): Promise<SynthesisChart> {
    if (accounts.length === 0) {
      return EMPTY_SYNTHESIS_CHART;
    }
    const currencyByAccount = new Map(accounts.map((a) => [a.id, a.currency] as const));
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
      latestValueDate(rows),
      parseSynthesisChartWindow(range),
    );
  }

  private async getLastSalary(
    fullyActiveAccountIds: string[],
    accounts: (typeof account.$inferSelect)[],
  ): Promise<DashboardIndicator | null> {
    if (fullyActiveAccountIds.length === 0) {
      return null;
    }
    const salaryCategoryId = this.config.get<string>('SALARY_CATEGORY_ID', SALARY_CATEGORY_SEED_ID);
    const [salaryCategory] = await this.db
      .select()
      .from(category)
      .where(eq(category.id, salaryCategoryId));
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
    fullyActiveAccountIds: string[],
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
    // deterministic tie-break by operation id — UUIDv7 ids sort
    // lexicographically in creation order, so a plain string compare works.
    const winner = rows.sort((a, b) =>
      b.debit! !== a.debit! ? b.debit! - a.debit! : a.id.localeCompare(b.id),
    )[0];
    const currency = accounts.find((a) => a.id === winner.accountId)!.currency;
    return {
      amount: toMajorUnits(winner.debit!),
      currency,
      valueDate: winner.valueDate,
    };
  }

  private async getHomepageReports(memberId: string): Promise<HomepageReportChart[]> {
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

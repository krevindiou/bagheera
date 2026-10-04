import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { balancesByAccount } from '../common/balances';
import { memberToday } from '../common/member-today';
import { MonthlyNet, monthlyNetByAccount, toSynthesisChartRow } from '../common/monthly-net';
import {
  computeSynthesisChart,
  latestValueDate,
  parseSynthesisChartWindow,
  SynthesisChart,
} from '../common/synthesis-chart';
import { MemberId } from '../security/ids';
import { isFullyActive, reachableAccountsOf } from '../security/reachable';
import { OwnershipService } from '../security/ownership.service';
import { DRIZZLE } from '../db/db.constants';
import { account, operation, report } from '../db/schema';
import { MinorUnits } from '../common/money';
import { ReportDistributionService } from '../reports/report-distribution.service';
import { ReportSeriesService } from '../reports/report-series.service';
import {
  AccountsOverviewBankDto,
  DashboardIndicatorDto,
  DashboardResponseDto,
  DistributionHomepageReportDto,
  SeriesHomepageReportDto,
  TotalBalanceDto,
} from './dto/dashboard-response.dto';

// Response shapes: the Swagger DTOs themselves (dto/dashboard-response.dto.ts).
export type OnboardingTip = DashboardResponseDto['onboarding'];

export type TotalBalance = TotalBalanceDto;

export type DashboardIndicator = DashboardIndicatorDto;

export type AccountsOverviewBank = AccountsOverviewBankDto;

export type HomepageReport = SeriesHomepageReportDto | DistributionHomepageReportDto;

export type DashboardResponse = DashboardResponseDto;

// Sparkline tiles show only a short recent window — a fraction of the
// synthesis chart's full 12-month one — since they carry no axis/labels to
// orient a longer history against.
const SPARKLINE_MONTHS = 6;

const EMPTY_SYNTHESIS_CHART: SynthesisChart = {
  hidden: true,
  axisBounds: null,
  series: [],
};

function previousCalendarMonthRange(today: string): { start: string; end: string } {
  const [year, month] = today.split('-').map(Number);
  const firstOfCurrentMonth = new Date(Date.UTC(year, month - 1, 1));
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
    private readonly ownership: OwnershipService,
    private readonly reportSeries: ReportSeriesService,
    private readonly reportDistributions: ReportDistributionService,
  ) {}

  // Per-account cumulative balance history, last `SPARKLINE_MONTHS` months —
  // one `computeSynthesisChart` call per account (reusing the exact same
  // per-account scoping AccountService.chart uses for the full 12-month
  // chart, including that each account's own window ends at its own latest
  // operation, not today), just trimmed to a shorter trailing window for
  // the tile sparkline. A single query sums every account's monthly
  // movements up front so this stays one round trip regardless of account
  // count.
  private accountHistories(
    accounts: (typeof account.$inferSelect)[],
    monthly: MonthlyNet[],
  ): Map<string, number[]> {
    const histories = new Map<string, number[]>();

    const monthlyByAccount = new Map<string, MonthlyNet[]>();
    for (const row of monthly) {
      const list = monthlyByAccount.get(row.accountId);
      if (list) {
        list.push(row);
      } else {
        monthlyByAccount.set(row.accountId, [row]);
      }
    }

    for (const acc of accounts) {
      const accMonthly = monthlyByAccount.get(acc.id);
      if (!accMonthly) {
        histories.set(acc.id, []);
        continue;
      }
      const rows = accMonthly.map((row) => toSynthesisChartRow(row, acc.currency));
      const synthesis = computeSynthesisChart(rows, latestValueDate(rows));
      const points = synthesis.series[0]?.points ?? [];
      histories.set(
        acc.id,
        points.slice(-SPARKLINE_MONTHS).map((p) => p.value),
      );
    }
    return histories;
  }

  async getDashboard(memberId: MemberId, range?: string): Promise<DashboardResponse> {
    const banks = await this.ownership.listOwnedBanks(memberId);
    if (banks.length === 0) {
      return {
        onboarding: 'no-bank',
        totalBalances: [],
        lastBiggestIncome: null,
        lastBiggestExpense: null,
        synthesisChart: EMPTY_SYNTHESIS_CHART,
        accountsOverview: [],
        homepageReports: [],
      };
    }

    const bankById = new Map(banks.map((b) => [b.id, b]));
    const hasActiveBank = banks.some((b) => !b.closed);
    const accountRows = await this.db
      .select({ account })
      .from(account)
      .where(reachableAccountsOf(this.db, memberId))
      .orderBy(asc(account.name));
    const accounts = accountRows.map((r) => r.account);

    const onboarding: OnboardingTip = accounts.length === 0 && hasActiveBank ? 'no-account' : null;

    const balances = await balancesByAccount(
      this.db,
      accounts.map((a) => a.id),
    );

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
        amount: amount as MinorUnits,
        reconciledAmount: (rawReconciledTotals.get(currency) ?? 0) as MinorUnits,
      }));

    const fullyActiveAccountIds = accounts
      .filter((a) => isFullyActive(a, bankById.get(a.bankId)!))
      .map((a) => a.id);

    const today = await memberToday(this.db, memberId);
    const [lastBiggestIncome, lastBiggestExpense, monthly] = await Promise.all([
      this.getBiggestEntry('credit', fullyActiveAccountIds, accounts, today),
      this.getBiggestEntry('debit', fullyActiveAccountIds, accounts, today),
      monthlyNetByAccount(
        this.db,
        accounts.map((a) => a.id),
      ),
    ]);
    const synthesisChart = this.getSynthesisChart(accounts, monthly, range);
    const histories = this.accountHistories(accounts, monthly);

    const accountsOverview: AccountsOverviewBank[] = banks
      .filter((b) => !b.closed)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((b) => ({
        id: b.id,
        name: b.name,
        accounts: accounts
          .filter((a) => a.bankId === b.id && isFullyActive(a, b))
          .sort((a, b2) => a.name.localeCompare(b2.name))
          .map((a) => ({
            id: a.id,
            name: a.name,
            currency: a.currency,
            // The `?? 0` fallback is an unbranded literal, so the whole
            // expression reads as plain `number` even on the found-in-map
            // branch.
            balance: (balances.get(a.id)?.balance ?? 0) as MinorUnits,
            reconciledBalance: (balances.get(a.id)?.reconciledBalance ?? 0) as MinorUnits,
            history: histories.get(a.id) ?? [],
          })),
      }));

    const homepageReports = await this.getHomepageReports(memberId);

    return {
      onboarding,
      totalBalances,
      lastBiggestIncome,
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
  private getSynthesisChart(
    accounts: (typeof account.$inferSelect)[],
    monthly: MonthlyNet[],
    range?: string,
  ): SynthesisChart {
    if (accounts.length === 0) {
      return EMPTY_SYNTHESIS_CHART;
    }
    const currencyByAccount = new Map(accounts.map((a) => [a.id, a.currency] as const));
    const rows = monthly.map((row) =>
      toSynthesisChartRow(row, currencyByAccount.get(row.accountId)!),
    );
    return computeSynthesisChart(rows, latestValueDate(rows), parseSynthesisChartWindow(range));
  }

  // Largest raw stored (minor-unit) amount on one side of the previous
  // calendar month wins, no currency conversion; deterministic tie-break by
  // operation id — UUIDv7 ids sort in creation order. Scheduler-generated
  // occurrences don't count.
  private async getBiggestEntry(
    side: 'credit' | 'debit',
    fullyActiveAccountIds: string[],
    accounts: (typeof account.$inferSelect)[],
    today: string,
  ): Promise<DashboardIndicator | null> {
    if (fullyActiveAccountIds.length === 0) {
      return null;
    }
    const { start, end } = previousCalendarMonthRange(today);
    const column = operation[side];

    const [winner] = await this.db
      .select()
      .from(operation)
      .where(
        and(
          inArray(operation.accountId, fullyActiveAccountIds),
          isNull(operation.schedulerId),
          isNotNull(column),
          sql`${operation.valueDate} >= ${start}`,
          sql`${operation.valueDate} <= ${end}`,
        ),
      )
      .orderBy(desc(column), asc(operation.id))
      .limit(1);
    if (!winner) {
      return null;
    }

    const currency = accounts.find((a) => a.id === winner.accountId)!.currency;
    return {
      amount: winner[side]!,
      currency,
      valueDate: winner.valueDate,
      thirdParty: winner.thirdParty,
    };
  }

  private async getHomepageReports(memberId: string): Promise<HomepageReport[]> {
    const homepageReports = await this.db
      .select()
      .from(report)
      .where(and(eq(report.memberId, memberId), eq(report.homepage, true)));

    const entries = await Promise.all(
      homepageReports.map(async (rpt): Promise<HomepageReport> => {
        if (rpt.type === 'distribution') {
          return {
            kind: 'distribution',
            id: rpt.id,
            title: rpt.title,
            distribution: await this.reportDistributions.computeDistribution(rpt, memberId),
          };
        }
        return {
          kind: 'series',
          id: rpt.id,
          title: rpt.title,
          series: await this.reportSeries.computeSeries(rpt, memberId),
        };
      }),
    );
    // A homepage report whose series/distribution has zero data points is
    // omitted.
    return entries.filter((entry) =>
      entry.kind === 'distribution' ? !entry.distribution.hidden : !entry.series.hidden,
    );
  }
}

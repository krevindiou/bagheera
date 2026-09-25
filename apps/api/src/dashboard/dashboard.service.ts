import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { balancesByAccount } from '../common/balances';
import { localIsoDate } from '../common/local-date';
import { toMajorUnits } from '../common/money';
import { MonthlyNet, monthlyNetByAccount, toSynthesisChartRow } from '../common/monthly-net';
import {
  computeSynthesisChart,
  latestValueDate,
  parseSynthesisChartWindow,
  SynthesisChart,
} from '../common/synthesis-chart';
import { MemberId } from '../security/ids';
import { DRIZZLE } from '../db/db.constants';
import { account, bank, operation, report } from '../db/schema';
import { MinorUnits } from '../common/money';
import {
  ReportDistribution,
  ReportDistributionService,
} from '../reports/report-distribution.service';
import { ReportSeries, ReportSeriesService } from '../reports/report-series.service';

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
  thirdParty: string;
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

// A homepage report is either a time series (sum/average) or a ranked
// distribution — the `kind` discriminant lets the web layer pick which
// component renders it without re-deriving that from `type`.
export type HomepageReport =
  | { kind: 'series'; id: string; title: string; series: ReportSeries }
  | { kind: 'distribution'; id: string; title: string; distribution: ReportDistribution };

export interface DashboardResponse {
  onboarding: OnboardingTip;
  totalBalances: TotalBalance[];
  lastBiggestIncome: DashboardIndicator | null;
  lastBiggestExpense: DashboardIndicator | null;
  synthesisChart: SynthesisChart;
  accountsOverview: AccountsOverviewBank[];
  homepageReports: HomepageReport[];
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
  const [year, month] = localIsoDate().split('-').map(Number);
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
    const banks = await this.db
      .select()
      .from(bank)
      .where(and(eq(bank.memberId, memberId), eq(bank.deleted, false)));
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

    const bankIds = banks.map((b) => b.id);
    const hasActiveBank = banks.some((b) => !b.closed);
    const accounts = await this.db
      .select()
      .from(account)
      .where(and(inArray(account.bankId, bankIds), eq(account.deleted, false)));

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
        amount: toMajorUnits(amount as MinorUnits),
        reconciledAmount: toMajorUnits((rawReconciledTotals.get(currency) ?? 0) as MinorUnits),
      }));

    // "Fully active" scope — the bank itself must also be non-closed.
    const activeBankIds = new Set(banks.filter((b) => !b.closed).map((b) => b.id));
    const fullyActiveAccountIds = accounts
      .filter((a) => !a.closed && activeBankIds.has(a.bankId))
      .map((a) => a.id);

    const [lastBiggestIncome, lastBiggestExpense, monthly] = await Promise.all([
      this.getBiggestEntry('credit', fullyActiveAccountIds, accounts),
      this.getBiggestEntry('debit', fullyActiveAccountIds, accounts),
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
  ): Promise<DashboardIndicator | null> {
    if (fullyActiveAccountIds.length === 0) {
      return null;
    }
    const { start, end } = previousCalendarMonthRange();
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
      amount: toMajorUnits(winner[side]!),
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

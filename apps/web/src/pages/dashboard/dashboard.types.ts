import type { ReportDistribution, ReportSeries } from '../reports/reports.types';

// The dashboard controller returns a plain object (no @ApiOkResponse DTO),
// so the generated API client types its body as `Record<string, never>`.
// This mirrors the actual shape (apps/api/src/dashboard/dashboard.service.ts).
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

export interface AccountsOverviewAccount {
  id: string;
  name: string;
  currency: string;
  balance: number;
  reconciledBalance: number;
  history: number[];
}

export interface AccountsOverviewBank {
  id: string;
  name: string;
  accounts: AccountsOverviewAccount[];
}

// A homepage report is either a time series (sum/average) or a ranked
// distribution — the `kind` discriminant picks which component renders it.
export type HomepageReport =
  | { kind: 'series'; id: string; title: string; series: ReportSeries }
  | { kind: 'distribution'; id: string; title: string; distribution: ReportDistribution };

export interface SynthesisChartPoint {
  period: string;
  value: number;
}

export interface SynthesisChartSeries {
  currency: string;
  points: SynthesisChartPoint[];
}

export interface DashboardSynthesisChart {
  hidden: boolean;
  axisBounds: { min: number; max: number } | null;
  series: SynthesisChartSeries[];
}

export interface DashboardResponse {
  onboarding: OnboardingTip;
  totalBalances: TotalBalance[];
  lastSalary: DashboardIndicator | null;
  lastBiggestExpense: DashboardIndicator | null;
  synthesisChart: DashboardSynthesisChart;
  accountsOverview: AccountsOverviewBank[];
  homepageReports: HomepageReport[];
}

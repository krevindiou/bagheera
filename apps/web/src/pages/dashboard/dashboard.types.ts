import type { ReportChart } from "../reports/reports.types";

// The dashboard controller returns a plain object (no @ApiOkResponse DTO),
// so the generated API client types its body as `Record<string, never>`.
// This mirrors the actual shape (apps/api/src/dashboard/dashboard.service.ts).
export type OnboardingTip = "no-bank" | "no-account" | null;

export interface TotalBalance {
  currency: string;
  amount: number;
}

export interface DashboardIndicator {
  amount: number;
  currency: string;
  valueDate: string;
}

export interface AccountsOverviewAccount {
  id: number;
  name: string;
  currency: string;
  balance: number;
}

export interface AccountsOverviewBank {
  id: number;
  name: string;
  accounts: AccountsOverviewAccount[];
}

export interface HomepageReportChart {
  id: number;
  title: string;
  chart: ReportChart;
}

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
  homepageReports: HomepageReportChart[];
}

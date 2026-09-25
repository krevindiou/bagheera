import type { components } from '../../api/schema';

type Schemas = components['schemas'];

export type DashboardResponse = Schemas['DashboardResponseDto'];
export type OnboardingTip = DashboardResponse['onboarding'];
export type TotalBalance = Schemas['TotalBalanceDto'];
export type DashboardIndicator = Schemas['DashboardIndicatorDto'];
export type AccountsOverviewAccount = Schemas['AccountsOverviewAccountDto'];
export type AccountsOverviewBank = Schemas['AccountsOverviewBankDto'];
export type SynthesisChartPoint = Schemas['ChartPointDto'];
export type SynthesisChartSeries = Schemas['SynthesisChartSeriesDto'];
export type DashboardSynthesisChart = Schemas['SynthesisChartDto'];

// A homepage report is either a time series (sum/average) or a ranked
// distribution — the `kind` discriminant picks which component renders it.
export type HomepageReport = DashboardResponse['homepageReports'][number];

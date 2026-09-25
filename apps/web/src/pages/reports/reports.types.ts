import type { components } from '../../api/schema';

type Schemas = components['schemas'];

export type Report = Omit<Schemas['ReportDto'], 'createdAt' | 'updatedAt'>;
export type ReportSeriesPoint = Schemas['ChartPointDto'];
export type ReportSeriesEntry = Schemas['ReportSeriesEntryDto'];
export type ReportSeries = Schemas['ReportSeriesDto'];
export type ReportDistributionPoint = Schemas['ChartPointDto'];
export type ReportDistributionLabelSeries = Schemas['ReportDistributionLabelSeriesDto'];
export type ReportDistributionSeries = Schemas['ReportDistributionSeriesDto'];
export type ReportDistribution = Schemas['ReportDistributionDto'];

// What ReportChart draws: a report's per-currency series or its
// distribution. The dashboard's HomepageReport is this plus an id/title.
export type ReportChartData =
  | { kind: 'series'; series: ReportSeries }
  | { kind: 'distribution'; distribution: ReportDistribution };

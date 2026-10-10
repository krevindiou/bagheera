import type { components } from '../../api/schema';

type Schemas = components['schemas'];

export type Report = Omit<Schemas['ReportDto'], 'createdAt' | 'updatedAt'>;
export type ReportSeries = Schemas['ReportSeriesDto'];
export type ReportDistributionLabelSeries = Schemas['ReportDistributionLabelSeriesDto'];
export type ReportDistribution = Schemas['ReportDistributionDto'];

// What ReportChart draws: a report's per-currency series or its
// distribution. A dashboard homepage report is this plus an id/title.
export type ReportChartData =
  | { kind: 'series'; series: ReportSeries }
  | { kind: 'distribution'; distribution: ReportDistribution };

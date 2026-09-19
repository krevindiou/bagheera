// The report controllers return plain rows (no @ApiOkResponse DTOs), so the
// generated API client types their bodies as `Record<string, never>`. This
// mirrors the actual shape (apps/api/src/db/schema/report.ts plus the
// service-computed accountIds — apps/api/src/reports/report.service.ts).
export interface Report {
  id: string;
  memberId: string;
  type: 'sum' | 'average' | 'distribution';
  title: string;
  homepage: boolean;
  valueDateStart: string | null;
  valueDateEnd: string | null;
  thirdParties: string | null;
  accountIds: string[];
  reconciledOnly: boolean | null;
  periodGrouping: 'month' | 'quarter' | 'year' | 'all';
  // Set only for a 'distribution' report; null otherwise.
  dataGrouping: 'category' | 'third_party' | 'payment_method' | null;
  significantResultsNumber: number | null;
}

export interface ReportSeriesPoint {
  period: string;
  value: number;
}

export interface ReportSeriesEntry {
  currency: string;
  credit: ReportSeriesPoint[];
  debit: ReportSeriesPoint[];
}

export interface ReportSeries {
  hidden: boolean;
  axisBounds: { min: number; max: number } | null;
  series: ReportSeriesEntry[];
}

export interface ReportDistributionPoint {
  period: string;
  value: number;
}

export interface ReportDistributionLabelSeries {
  // null = the collapsed "Other" bucket: the ranked tail past the top N,
  // plus any uncategorized operations. Fixed across the whole report's
  // date range, so a stacked chart's segments stay stable period to
  // period — see apps/api/src/reports/report-distribution.service.ts.
  label: string | null;
  // One point per period; a snapshot ('all' periodGrouping) report has
  // exactly one.
  points: ReportDistributionPoint[];
}

export interface ReportDistributionSeries {
  currency: string;
  debit: ReportDistributionLabelSeries[];
  credit: ReportDistributionLabelSeries[];
}

export interface ReportDistribution {
  hidden: boolean;
  series: ReportDistributionSeries[];
}

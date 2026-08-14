// The report controllers return plain rows (no @ApiOkResponse DTOs), so the
// generated API client types their bodies as `Record<string, never>`. This
// mirrors the actual shape (apps/api/src/db/schema/report.ts plus the
// service-computed accountIds — apps/api/src/reports/report.service.ts).
export interface Report {
  id: number;
  memberId: number;
  type: "sum" | "average";
  title: string;
  homepage: boolean;
  valueDateStart: string | null;
  valueDateEnd: string | null;
  thirdParties: string | null;
  accountIds: number[];
  reconciledOnly: boolean | null;
  periodGrouping: "month" | "quarter" | "year" | "all";
}

export interface ReportChartPoint {
  period: string;
  value: number;
}

export interface ReportChartSeries {
  currency: string;
  credit: ReportChartPoint[];
  debit: ReportChartPoint[];
}

export interface ReportChart {
  hidden: boolean;
  axisBounds: { min: number; max: number } | null;
  series: ReportChartSeries[];
}

// Shared x-axis label formatting for every chart keyed by report period
// (SynthesisChart's line series, RankedChart's stacked bars) — a
// stored period is an ISO date string ('YYYY-MM-DD') or any parseable
// 'YYYY-MM...' string; only the year/month are shown.
export function formatPeriodLabel(period: string): string {
  const [year, month] = period.split('-');
  return `${year}-${Number(month)}`;
}

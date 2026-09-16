// Shared range option for the synthesis chart's window selector — used by
// both the dashboard chart (DashboardPage.vue) and the per-account chart
// (OperationsPage.vue), which both wrap SynthesisChart.vue and both send
// this straight through as the API's `range` query param (see
// apps/api/src/common/synthesis-chart.ts's `parseSynthesisChartWindow`).
export type SynthesisChartRange = '12' | '24' | 'all';

export const SYNTHESIS_CHART_RANGES: SynthesisChartRange[] = ['12', '24', 'all'];

export const DEFAULT_SYNTHESIS_CHART_RANGE: SynthesisChartRange = '12';

// i18n key per range, for the `<select>` options both pages render.
export const SYNTHESIS_CHART_RANGE_LABEL_KEYS: Record<SynthesisChartRange, string> = {
  '12': 'chartRange.months12',
  '24': 'chartRange.months24',
  all: 'chartRange.all',
};

// The synthesis chart's window choices, sent as the API's `range` param.
export type SynthesisChartRange = '12' | '24' | 'all';

export const SYNTHESIS_CHART_RANGES: SynthesisChartRange[] = ['12', '24', 'all'];

export const DEFAULT_SYNTHESIS_CHART_RANGE: SynthesisChartRange = '12';

// i18n key per range, for the panel's `<select>` options.
export const SYNTHESIS_CHART_RANGE_LABEL_KEYS: Record<SynthesisChartRange, string> = {
  '12': 'chartRange.months12',
  '24': 'chartRange.months24',
  all: 'chartRange.all',
};

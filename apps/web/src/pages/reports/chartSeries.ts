import { colorForCurrency } from '../../components/chartColors';
import { toDisplayPoints } from '../../domain/money';
import type { SynthesisChartSeries } from '../../components/SynthesisChart.vue';
import type { ReportSeries } from './reports.types';

// Color carries the currency, so debit/credit is told apart by dash
// (debit dashed), which also survives colorblindness.
const DEBIT_DASH = [8, 4];

/**
 * Flattens a report's per-currency debit/credit series into one chart
 * series per currency×side, omitting empty sides. `t` is passed in: this
 * isn't a component, so no `useI18n()`.
 */
export function toChartSeries(
  reportSeries: ReportSeries,
  t: (key: string) => string,
): SynthesisChartSeries[] {
  const series: SynthesisChartSeries[] = [];
  for (const s of reportSeries.series) {
    const color = colorForCurrency(s.currency);
    if (s.debit.length > 0) {
      series.push({
        label: `${s.currency} ${t('operations.debit')}`,
        color,
        dash: DEBIT_DASH,
        points: toDisplayPoints(s.debit, s.currency),
      });
    }
    if (s.credit.length > 0) {
      series.push({
        label: `${s.currency} ${t('operations.credit')}`,
        color,
        points: toDisplayPoints(s.credit, s.currency),
      });
    }
  }
  return series;
}

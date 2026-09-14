import type { SynthesisChartSeries } from '../../components/SynthesisChart.vue';
import type { ReportChart } from './reports.types';

const CHART_COLORS = { debit: '#e8697a', credit: '#5fd98d' };

/**
 * A report/dashboard chart is per-currency, each with a separate debit and
 * credit series (apps/api/src/reports/chart.service.ts) — flattened here
 * into the shared chart component's series list, one entry per
 * currency×type (a currency with no points on one side is omitted rather
 * than shown as an empty series). Shared by ReportsPage and DashboardPage,
 * which both render report charts. `t` is vue-i18n's translate function,
 * passed in rather than called via `useI18n()` here since this isn't a
 * component/composable — it's a plain function, so it can't use Composition
 * API itself.
 */
export function toChartSeries(
  chart: ReportChart,
  t: (key: string) => string,
): SynthesisChartSeries[] {
  const series: SynthesisChartSeries[] = [];
  for (const s of chart.series) {
    if (s.debit.length > 0) {
      series.push({
        label: `${s.currency} ${t('operations.debit')}`,
        color: CHART_COLORS.debit,
        points: s.debit,
      });
    }
    if (s.credit.length > 0) {
      series.push({
        label: `${s.currency} ${t('operations.credit')}`,
        color: CHART_COLORS.credit,
        points: s.credit,
      });
    }
  }
  return series;
}

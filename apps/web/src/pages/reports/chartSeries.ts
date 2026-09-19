import { colorForCurrency } from '../../components/chartColors';
import type { SynthesisChartSeries } from '../../components/SynthesisChart.vue';
import type { ReportSeries } from './reports.types';

// Debit is dashed, credit solid — a report with a single currency already
// reads fine on color alone, but two currencies each showing a debit+credit
// pair used to collide: both debit lines were plain red and both credit
// lines plain green, so the *currency* was unreadable. Color now carries
// currency identity (colorForCurrency, same hash-based palette as every
// other chart in the app — see chartColors.ts), and this dash pattern
// carries debit/credit as an orthogonal channel, which also makes the
// distinction survive grayscale/colorblind simulation rather than relying
// on a red/green pair alone.
const DEBIT_DASH = [8, 4];

/**
 * A report/dashboard series is per-currency, each with a separate debit and
 * credit series (apps/api/src/reports/report-series.service.ts) — flattened
 * here into the shared chart component's series list, one entry per
 * currency×type (a currency with no points on one side is omitted rather
 * than shown as an empty series). Shared by ReportsPage and DashboardPage,
 * which both render report charts. `t` is vue-i18n's translate function,
 * passed in rather than called via `useI18n()` here since this isn't a
 * component/composable — it's a plain function, so it can't use Composition
 * API itself.
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
        points: s.debit,
      });
    }
    if (s.credit.length > 0) {
      series.push({
        label: `${s.currency} ${t('operations.credit')}`,
        color,
        points: s.credit,
      });
    }
  }
  return series;
}

import { colorForLabel } from '../../components/chartColors';
import { toDisplayAmount } from '../operations/money';
import type {
  RankedChartBar,
  RankedChartFacet,
  RankedChartStackedSeries,
} from '../../components/RankedChart.vue';
import type { ReportDistribution, ReportDistributionLabelSeries } from './reports.types';

// A muted, palette-independent color for the collapsed "Other" bucket — it
// isn't a real category, so it shouldn't compete for a spot in the
// categorical palette the way a genuine label does (two different reports'
// "Other" bars staying visually distinct from each other would be
// meaningless; what matters is that it reads as "not a real category" in
// every report).
const OTHER_COLOR = 'rgba(242, 239, 233, 0.35)';

function labelText(label: string | null, t: (key: string) => string): string {
  return label === null ? t('reports.other') : label;
}

function labelColor(label: string | null): string {
  return label === null ? OTHER_COLOR : colorForLabel(label);
}

// A facet is a snapshot when every label series (both sides) has at most
// one point — a single period ('all' periodGrouping, or a date range that
// happens to fall within one period) has nothing to stack against, so it
// renders as a horizontal ranked bar chart instead of a stacked-over-time
// one. Debit and credit always share the same period axis for a given
// currency (report-distribution.service.ts computes both from the same
// per-currency period set), so checking either side alone would do, but
// checking both is a cheap extra guard against that invariant drifting.
function isSnapshot(
  debit: ReportDistributionLabelSeries[],
  credit: ReportDistributionLabelSeries[],
): boolean {
  return debit.every((s) => s.points.length <= 1) && credit.every((s) => s.points.length <= 1);
}

// Debit is negated (credit stays positive) so the two sides diverge from one
// shared zero baseline in a single chart — the standard "cash flow"
// convention — rather than needing a separate chart per side. `sign * 0`
// produces `-0` for a negated zero-filled gap, which some renderers show as
// "-$0.00" — `+ 0` normalizes it back to plain `0`.
function negate(value: number, sign: 1 | -1, currency: string): number {
  return sign * toDisplayAmount(value, currency) + 0;
}

function toBars(
  labelSeriesList: ReportDistributionLabelSeries[],
  currency: string,
  sign: 1 | -1,
  t: (key: string) => string,
): RankedChartBar[] {
  return labelSeriesList.map((series) => ({
    label: labelText(series.label, t),
    value: negate(series.points[0]?.value ?? 0, sign, currency),
    color: labelColor(series.label),
  }));
}

function toStackedSeries(
  labelSeriesList: ReportDistributionLabelSeries[],
  currency: string,
  sign: 1 | -1,
  t: (key: string) => string,
): RankedChartStackedSeries[] {
  return labelSeriesList.map((series) => ({
    label: labelText(series.label, t),
    color: labelColor(series.label),
    points: series.points.map((point) => ({
      period: point.period,
      value: negate(point.value, sign, currency),
    })),
  }));
}

function toRankedFacet(
  currency: string,
  debit: ReportDistributionLabelSeries[],
  credit: ReportDistributionLabelSeries[],
  t: (key: string) => string,
): RankedChartFacet {
  if (isSnapshot(debit, credit)) {
    // Credit's and debit's own top-N rankings are independent (see
    // report-distribution.service.ts) — merging them into one list here
    // orders by magnitude regardless of side, so the chart reads as one
    // ranking rather than two concatenated ones.
    const bars = [...toBars(credit, currency, 1, t), ...toBars(debit, currency, -1, t)].sort(
      (a, b) => Math.abs(b.value) - Math.abs(a.value),
    );
    return { kind: 'snapshot', title: currency, currency, bars };
  }
  const series = [
    ...toStackedSeries(credit, currency, 1, t),
    ...toStackedSeries(debit, currency, -1, t),
  ];
  return { kind: 'temporal', title: currency, currency, series };
}

/**
 * A distribution report is per-currency, with a separate debit and credit
 * ranking (apps/api/src/reports/report-distribution.service.ts) — combined
 * here into one facet per currency (debit negated, credit positive, one
 * diverging chart) rather than a chart per side. `t` is vue-i18n's
 * translate function, passed in rather than called via `useI18n()` here
 * since this isn't a component/composable — mirrors chartSeries.ts's
 * toChartSeries.
 */
export function toDistributionFacets(
  distribution: ReportDistribution,
  t: (key: string) => string,
): RankedChartFacet[] {
  return distribution.series
    .filter((s) => s.debit.length > 0 || s.credit.length > 0)
    .map((s) => toRankedFacet(s.currency, s.debit, s.credit, t));
}

import { colorForLabel } from '../../components/chartColors';
import { referenceName } from '../../i18n/referenceNames';
import { toDisplayAmount } from '../../domain/money';
import type {
  RankedChartBar,
  RankedChartFacet,
  RankedChartStackedSeries,
} from '../../components/RankedChart.vue';
import type { ReportDistribution, ReportDistributionLabelSeries } from './reports.types';

// Muted and outside the palette: "Other" isn't a real label.
const OTHER_COLOR = 'rgba(242, 239, 233, 0.35)';

function labelText(label: string | null, t: (key: string) => string): string {
  return label === null ? t('reports.other') : label;
}

function labelColor(label: string | null): string {
  return label === null ? OTHER_COLOR : colorForLabel(label);
}

// A single period has nothing to stack: render ranked bars instead.
function isSnapshot(
  debit: ReportDistributionLabelSeries[],
  credit: ReportDistributionLabelSeries[],
): boolean {
  return debit.every((s) => s.points.length <= 1) && credit.every((s) => s.points.length <= 1);
}

// Debit negated so both sides diverge from zero in one chart. `+ 0` turns
// `-0` (shown as "-$0.00") into `0`.
function negate(value: number, sign: 1 | -1, currency: string): number {
  return sign * toDisplayAmount(value, currency) + 0;
}

function toBars(
  labelSeriesList: ReportDistributionLabelSeries[],
  currency: string,
  sign: 1 | -1,
  labelOf: (label: string | null) => string,
): RankedChartBar[] {
  return labelSeriesList.map((series) => ({
    label: labelOf(series.label),
    value: negate(series.points[0]?.value ?? 0, sign, currency),
    color: labelColor(series.label),
  }));
}

function toStackedSeries(
  labelSeriesList: ReportDistributionLabelSeries[],
  currency: string,
  sign: 1 | -1,
  labelOf: (label: string | null) => string,
): RankedChartStackedSeries[] {
  return labelSeriesList.map((series) => ({
    label: labelOf(series.label),
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
  labelOf: (label: string | null) => string,
): RankedChartFacet {
  if (isSnapshot(debit, credit)) {
    // One ranking by magnitude across both sides.
    const bars = [
      ...toBars(credit, currency, 1, labelOf),
      ...toBars(debit, currency, -1, labelOf),
    ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    return { kind: 'snapshot', title: currency, currency, bars };
  }
  const series = [
    ...toStackedSeries(credit, currency, 1, labelOf),
    ...toStackedSeries(debit, currency, -1, labelOf),
  ];
  return { kind: 'temporal', title: currency, currency, series };
}

/**
 * One diverging facet per currency from its debit and credit rankings. `t`
 * is passed in, as in toChartSeries.
 */
export function toDistributionFacets(
  distribution: ReportDistribution,
  t: (key: string) => string,
): RankedChartFacet[] {
  // Category and payment-method labels are seeded reference data, shown
  // translated; third-party labels are the member's own text.
  const translateLabels = distribution.dataGrouping !== 'third_party';
  const labelOf = (label: string | null) =>
    label !== null && translateLabels ? referenceName(label) : labelText(label, t);
  return distribution.series
    .filter((s) => s.debit.length > 0 || s.credit.length > 0)
    .map((s) => toRankedFacet(s.currency, s.debit, s.credit, labelOf));
}

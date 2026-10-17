import type { PeriodGrouping } from '@bagheera/reference-data';
import { assignLabelColors } from '../../components/chartColors';
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

type Side = 'debit' | 'credit';

// The API sends one null-labelled "Other" bucket per side, so the side
// decides which of the two it is.
function labelText(label: string | null, side: Side, t: (key: string) => string): string {
  if (label !== null) return label;
  return t(side === 'debit' ? 'reports.otherExpenses' : 'reports.otherIncome');
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
  colorOf: (label: string | null) => string,
): RankedChartBar[] {
  return labelSeriesList.map((series) => ({
    label: labelOf(series.label),
    value: negate(series.points[0]?.value ?? 0, sign, currency),
    color: colorOf(series.label),
  }));
}

function toStackedSeries(
  labelSeriesList: ReportDistributionLabelSeries[],
  currency: string,
  sign: 1 | -1,
  labelOf: (label: string | null) => string,
  colorOf: (label: string | null) => string,
): RankedChartStackedSeries[] {
  return labelSeriesList.map((series) => ({
    label: labelOf(series.label),
    color: colorOf(series.label),
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
  labelOf: (label: string | null, side: Side) => string,
  periodGrouping: PeriodGrouping,
): RankedChartFacet {
  // Colors are dealt per chart, so same-named labels on both sides share one.
  const palette = assignLabelColors(
    [...credit, ...debit].map((s) => s.label).filter((label): label is string => label !== null),
  );
  const colorOf = (label: string | null) => (label === null ? OTHER_COLOR : palette.get(label)!);
  const creditLabel = (label: string | null) => labelOf(label, 'credit');
  const debitLabel = (label: string | null) => labelOf(label, 'debit');
  if (isSnapshot(debit, credit)) {
    // One ranking by magnitude across both sides.
    const bars = [
      ...toBars(credit, currency, 1, creditLabel, colorOf),
      ...toBars(debit, currency, -1, debitLabel, colorOf),
    ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    return { kind: 'snapshot', title: currency, currency, bars };
  }
  const series = [
    ...toStackedSeries(credit, currency, 1, creditLabel, colorOf),
    ...toStackedSeries(debit, currency, -1, debitLabel, colorOf),
  ];
  return { kind: 'temporal', title: currency, currency, periodGrouping, series };
}

/**
 * One diverging facet per currency from its debit and credit rankings. `t`
 * is passed in, as in toChartSeries; `periodGrouping` is the report's, which
 * the distribution payload doesn't carry.
 */
export function toDistributionFacets(
  distribution: ReportDistribution,
  t: (key: string) => string,
  periodGrouping: PeriodGrouping,
): RankedChartFacet[] {
  // Category and payment-method labels are seeded reference data, shown
  // translated; third-party labels are the member's own text.
  const translateLabels = distribution.dataGrouping !== 'third_party';
  const labelOf = (label: string | null, side: Side) =>
    label !== null && translateLabels ? referenceName(label) : labelText(label, side, t);
  return distribution.series
    .filter((s) => s.debit.length > 0 || s.credit.length > 0)
    .map((s) => toRankedFacet(s.currency, s.debit, s.credit, labelOf, periodGrouping));
}

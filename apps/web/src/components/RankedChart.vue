<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Bar } from 'vue-chartjs';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type TooltipItem,
} from 'chart.js';
import { formatMoney } from '../pages/operations/money';
import { formatPeriodLabel } from './periodLabel';
import type { Locale } from '../i18n/locales';

ChartJS.register(CategoryScale, LinearScale, BarElement, Legend, Tooltip);

// Matches ChartJS.defaults.borderColor (set once, app-wide, in
// SynthesisChart.vue) — the ordinary gridline color every chart already
// uses, so the zero baseline's gridline blends in except for its own
// emphasis below.
const GRID_COLOR = 'rgba(242, 239, 233, 0.1)';
// A visibly stronger line specifically at the zero baseline — credit and
// debit diverge from it in both chart modes, so it needs to read as a
// deliberate axis, not just another gridline.
const ZERO_LINE_COLOR = 'rgba(242, 239, 233, 0.45)';

// Scriptable grid color/width: every gridline gets the ordinary color and
// a hairline width, except the one at value 0, which is thicker and more
// opaque — the shared "separate positive from negative" treatment for
// both the snapshot chart's x-axis and the temporal chart's y-axis.
function emphasizeZero(ctx: { tick: { value: number } }): string {
  return ctx.tick.value === 0 ? ZERO_LINE_COLOR : GRID_COLOR;
}
function emphasizeZeroWidth(ctx: { tick: { value: number } }): number {
  return ctx.tick.value === 0 ? 2 : 1;
}

export interface RankedChartBar {
  label: string;
  // Major-units amount (already toMajorUnits-converted, same convention as
  // SynthesisChart's points) — credit positive, debit negative, so debit
  // and credit bars diverge from one shared zero baseline in the same
  // chart (distributionSeries.ts negates debit before building this).
  value: number;
  color: string;
}

export interface RankedChartStackedPoint {
  period: string;
  value: number;
}

export interface RankedChartStackedSeries {
  label: string;
  color: string;
  // Same credit-positive/debit-negative convention as RankedChartBar.value
  // — Chart.js stacks positive-valued datasets upward and negative-valued
  // ones downward from zero within the same `stack` group, so credit and
  // debit series diverge in one stacked chart rather than needing two.
  points: RankedChartStackedPoint[];
}

// A facet is one currency, combining both debit and credit (as a diverging
// chart — see the sign convention on RankedChartBar/RankedChartStackedSeries
// above) rather than one chart per side. Ranked once over its whole date
// range: with a single period ('all' periodGrouping, or a range that
// happens to fall in one period), that ranking has nothing to stack against
// and renders as a plain horizontal ranked bar chart; with more than one
// period, the same ranking becomes the fixed segment set of a
// stacked-over-time bar chart. Both are Chart.js `Bar` — only the axis
// orientation and dataset shape differ — rather than a plain-HTML fallback
// for the single-period case, so the whole component stays one rendering
// technology. `report-distribution.service.ts`'s per-label `points` arrays
// already carry both shapes — `toDistributionFacets` (distributionSeries.ts)
// picks the mode from how many points are present.
export type RankedChartFacet =
  | { kind: 'snapshot'; title: string; currency: string; bars: RankedChartBar[] }
  | { kind: 'temporal'; title: string; currency: string; series: RankedChartStackedSeries[] };

const props = defineProps<{ facets: RankedChartFacet[] }>();

const { locale } = useI18n();

// Hidden whenever every facet has no data, same hide-when-empty rule used
// by SynthesisChart/reports/dashboard.
const hasData = computed(() =>
  props.facets.some(
    (facet) => (facet.kind === 'snapshot' ? facet.bars.length : facet.series.length) > 0,
  ),
);

// A ranked bar list needs enough vertical room per row to stay legible —
// unlike the stacked (temporal) chart, whose height doesn't depend on how
// many labels it has (they're stacked, not stacked *rows*).
function snapshotHeight(bars: RankedChartBar[]): number {
  return Math.max(bars.length * 32, 80);
}

function snapshotChartData(facet: RankedChartFacet & { kind: 'snapshot' }): ChartData<'bar'> {
  return {
    labels: facet.bars.map((bar) => bar.label),
    datasets: [
      {
        data: facet.bars.map((bar) => bar.value),
        backgroundColor: facet.bars.map((bar) => bar.color),
        categoryPercentage: 0.6,
        barPercentage: 0.7,
      },
    ],
  };
}

function snapshotChartOptions(currency: string): ChartOptions<'bar'> {
  return {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: emphasizeZero, lineWidth: emphasizeZeroWidth },
      },
      // Chart.js draws a horizontal bar chart's first category at the
      // bottom by default — `reverse` puts the highest-ranked (first)
      // label at the top, matching how a ranking normally reads.
      y: { reverse: true },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (item: TooltipItem<'bar'>) => formatMoney(item.parsed.x ?? 0, currency, true),
        },
      },
    },
  };
}

function stackedChartData(facet: RankedChartFacet & { kind: 'temporal' }): ChartData<'bar'> {
  const reference = facet.series[0];
  return {
    labels: reference
      ? reference.points.map((point) => formatPeriodLabel(point.period, locale.value as Locale))
      : [],
    datasets: facet.series.map((series) => ({
      label: series.label,
      data: series.points.map((point) => point.value),
      backgroundColor: series.color,
      // Every dataset shares one stack, so bars sum to the period total
      // rather than sitting side by side.
      stack: 'ranked',
      categoryPercentage: 0.6,
      barPercentage: 0.7,
    })),
  };
}

function stackedChartOptions(currency: string): ChartOptions<'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { stacked: true, ticks: { autoSkip: true, maxRotation: 0 } },
      y: {
        stacked: true,
        grid: { color: emphasizeZero, lineWidth: emphasizeZeroWidth },
      },
    },
    plugins: {
      legend: { display: true },
      tooltip: {
        callbacks: {
          label: (item: TooltipItem<'bar'>) =>
            `${item.dataset.label}: ${formatMoney(item.parsed.y ?? 0, currency, true)}`,
        },
      },
    },
  };
}
</script>

<template>
  <div v-if="hasData" class="ranked-chart">
    <div v-for="facet in props.facets" :key="facet.title" class="ranked-chart-facet">
      <h4 class="ranked-chart-title">{{ facet.title }}</h4>

      <div
        v-if="facet.kind === 'snapshot'"
        class="ranked-chart-canvas"
        :style="{ height: `${snapshotHeight(facet.bars)}px` }"
        data-testid="ranked-snapshot-chart"
      >
        <Bar :data="snapshotChartData(facet)" :options="snapshotChartOptions(facet.currency)" />
      </div>

      <div v-else class="ranked-chart-canvas" data-testid="ranked-stacked-chart">
        <Bar :data="stackedChartData(facet)" :options="stackedChartOptions(facet.currency)" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ranked-chart-facet + .ranked-chart-facet {
  margin-top: 24px;
}

.ranked-chart-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--paper-dim, rgba(242, 239, 233, 0.62));
  margin-bottom: 12px;
}

.ranked-chart-canvas {
  height: 240px;
}
</style>

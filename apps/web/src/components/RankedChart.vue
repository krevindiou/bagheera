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
import { formatDisplayMoney } from '../domain/money';
import { formatPeriodLabel } from './periodLabel';
import type { Locale } from '../i18n/locales';

ChartJS.register(CategoryScale, LinearScale, BarElement, Legend, Tooltip);

// The app-wide gridline color (ChartJS.defaults.borderColor).
const GRID_COLOR = 'rgba(242, 239, 233, 0.1)';
// Credit and debit diverge from zero, so its gridline reads as an axis.
const ZERO_LINE_COLOR = 'rgba(242, 239, 233, 0.45)';

function emphasizeZero(ctx: { tick: { value: number } }): string {
  return ctx.tick.value === 0 ? ZERO_LINE_COLOR : GRID_COLOR;
}
function emphasizeZeroWidth(ctx: { tick: { value: number } }): number {
  return ctx.tick.value === 0 ? 2 : 1;
}

export interface RankedChartBar {
  label: string;
  // Decimal amount: credit positive, debit negative, diverging from zero.
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
  // Signed like RankedChartBar.value: Chart.js stacks negatives downward.
  points: RankedChartStackedPoint[];
}

// One diverging chart per currency. A single period renders as horizontal
// ranked bars ('snapshot'); several as bars stacked over time ('temporal'),
// with the ranking as fixed segments. toDistributionFacets picks the kind.
export type RankedChartFacet =
  | { kind: 'snapshot'; title: string; currency: string; bars: RankedChartBar[] }
  | { kind: 'temporal'; title: string; currency: string; series: RankedChartStackedSeries[] };

const props = defineProps<{ facets: RankedChartFacet[] }>();

const { locale } = useI18n();

// Hidden when every facet is empty.
const hasData = computed(() =>
  props.facets.some(
    (facet) => (facet.kind === 'snapshot' ? facet.bars.length : facet.series.length) > 0,
  ),
);

// Height per row, unlike the stacked chart.
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
      // Highest-ranked on top.
      y: { reverse: true },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (item: TooltipItem<'bar'>) => formatDisplayMoney(item.parsed.x ?? 0, currency),
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
            `${item.dataset.label}: ${formatDisplayMoney(item.parsed.y ?? 0, currency)}`,
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

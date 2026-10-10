<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Line } from 'vue-chartjs';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type ScriptableContext,
  type TooltipItem,
} from 'chart.js';
import { verticalFillGradient } from './chartColors';
import { formatPeriodLabel } from './periodLabel';
import type { Locale } from '../i18n/locales';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Legend, Tooltip);

// Dark "FinTech-Noir" theme — Chart.js defaults to black-on-transparent,
// which is unreadable against the app's near-black background.
ChartJS.defaults.font.family = "'Archivo', sans-serif";
ChartJS.defaults.color = 'rgba(242, 239, 233, 0.62)'; // --paper-dim: ticks/legend text
ChartJS.defaults.borderColor = 'rgba(242, 239, 233, 0.1)'; // --hair: gridlines

export interface SynthesisChartPoint {
  // Period start as an ISO date string ('YYYY-MM-DD') or any parseable
  // 'YYYY-MM...' string — only the year/month are used for the label.
  period: string;
  value: number;
}

export interface SynthesisChartSeries {
  label: string;
  color: string;
  // Chart.js dash pattern (e.g. [8, 4]): a non-color cue (debit vs credit)
  // that survives CVD. Solid when omitted.
  dash?: number[];
  points: SynthesisChartPoint[];
}

export interface SynthesisAxisBounds {
  min: number;
  max: number;
}

const props = defineProps<{
  series: SynthesisChartSeries[];
  axisBounds?: SynthesisAxisBounds | null;
}>();

const { locale } = useI18n();

// Hidden when every series is empty.
const hasData = computed(() => props.series.some((series) => series.points.length > 0));

// Every series is expected to share the same set of periods (callers
// zero-fill gaps before passing data in), so labels come from the first
// non-empty series.
const labels = computed(() => {
  const reference = props.series.find((series) => series.points.length > 0);
  return reference
    ? reference.points.map((point) => formatPeriodLabel(point.period, locale.value as Locale))
    : [];
});

const chartData = computed<ChartData<'line'>>(() => ({
  labels: labels.value,
  datasets: props.series.map((series) => ({
    label: series.label,
    data: series.points.map((point) => point.value),
    borderColor: series.color,
    backgroundColor: (ctx: ScriptableContext<'line'>) => verticalFillGradient(series.color, ctx),
    borderDash: series.dash ?? [],
    borderWidth: 1.5,
    fill: true,
    tension: 0.2,
    pointRadius: 3,
    pointHoverRadius: 4,
  })),
}));

const chartOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      ticks: {
        autoSkip: true,
        maxRotation: 0,
      },
    },
    y: {
      suggestedMin: props.axisBounds?.min,
      suggestedMax: props.axisBounds?.max,
      ticks: {
        // Default ticking crowds the axis with long money labels: fewer,
        // rounded ticks.
        maxTicksLimit: 6,
        precision: 0,
        callback: (value) =>
          new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }).format(value as number),
      },
    },
  },
  plugins: {
    legend: { display: true },
    tooltip: {
      callbacks: {
        label: (item: TooltipItem<'line'>) => `${item.formattedValue} (${item.label})`,
      },
    },
  },
}));
</script>

<template>
  <div v-if="hasData" class="synthesis-chart">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<style scoped>
/* Chart.js (responsive + maintainAspectRatio:false above) sizes its canvas
   to fill this container — with no height of its own it fell back to a
   cramped intrinsic size, squashing the y-axis. */
.synthesis-chart {
  height: 300px;
}
</style>

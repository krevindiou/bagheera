<script setup lang="ts">
import { computed } from 'vue';
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
  type TooltipItem,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Legend, Tooltip);

// Dark "FinTech-Noir" theme — Chart.js defaults to black-on-transparent,
// which is unreadable against the app's near-black background.
ChartJS.defaults.font.family = "'Archivo', sans-serif";
ChartJS.defaults.color = 'rgba(242, 239, 233, 0.62)'; // --paper-dim: ticks/legend text
ChartJS.defaults.borderColor = 'rgba(242, 239, 233, 0.1)'; // --hair: gridlines

// A translucent fill under a solid line (rather than a flat, opaque one)
// matches the design's "abstract filled line-chart" look.
function withAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface SynthesisChartPoint {
  // Period start as an ISO date string ('YYYY-MM-DD') or any parseable
  // 'YYYY-MM...' string — only the year/month are used for the label.
  period: string;
  value: number;
}

export interface SynthesisChartSeries {
  label: string;
  color: string;
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

// Hidden whenever every series has no data points, per the shared
// hide-when-empty rule used by reports/dashboard/operation-list charts.
const hasData = computed(() => props.series.some((series) => series.points.length > 0));

function formatPeriodLabel(period: string): string {
  const [year, month] = period.split('-');
  return `${year}-${Number(month)}`;
}

// Every series is expected to share the same set of periods (callers
// zero-fill gaps before passing data in), so labels come from the first
// non-empty series.
const labels = computed(() => {
  const reference = props.series.find((series) => series.points.length > 0);
  return reference ? reference.points.map((point) => formatPeriodLabel(point.period)) : [];
});

// Past a short window, a dot per point turns into visual noise once the
// selector widens the range to 24 months or the account's whole history —
// the line + fill alone carries the shape just as well. Hover targeting
// stays intact via `pointHoverRadius` regardless.
const DENSE_POINT_COUNT = 15;
const pointRadius = computed(() => {
  const longestSeries = Math.max(0, ...props.series.map((series) => series.points.length));
  return longestSeries > DENSE_POINT_COUNT ? 0 : 3;
});

const chartData = computed<ChartData<'line'>>(() => ({
  labels: labels.value,
  datasets: props.series.map((series) => ({
    label: series.label,
    data: series.points.map((point) => point.value),
    borderColor: series.color,
    backgroundColor: withAlpha(series.color, 0.18),
    fill: true,
    tension: 0.2,
    pointRadius: pointRadius.value,
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

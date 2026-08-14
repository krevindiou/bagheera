<script setup lang="ts">
import { computed } from "vue";
import { Line } from "vue-chartjs";
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
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Legend, Tooltip);

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
  const [year, month] = period.split("-");
  return `${year}-${Number(month)}`;
}

// Every series is expected to share the same set of periods (callers
// zero-fill gaps before passing data in), so labels come from the first
// non-empty series.
const labels = computed(() => {
  const reference = props.series.find((series) => series.points.length > 0);
  return reference ? reference.points.map((point) => formatPeriodLabel(point.period)) : [];
});

const chartData = computed<ChartData<"line">>(() => ({
  labels: labels.value,
  datasets: props.series.map((series) => ({
    label: series.label,
    data: series.points.map((point) => point.value),
    borderColor: series.color,
    backgroundColor: series.color,
    fill: true,
    tension: 0.2,
  })),
}));

const chartOptions = computed<ChartOptions<"line">>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      min: props.axisBounds?.min,
      max: props.axisBounds?.max,
    },
  },
  plugins: {
    legend: { display: true },
    tooltip: {
      callbacks: {
        label: (item: TooltipItem<"line">) => `${item.formattedValue} (${item.label})`,
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

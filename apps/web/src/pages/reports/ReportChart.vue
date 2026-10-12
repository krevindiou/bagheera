<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import LoadError from '../../components/LoadError.vue';
import RankedChart from '../../components/RankedChart.vue';
import SynthesisChart from '../../components/SynthesisChart.vue';
import { toDisplayBounds } from '../../domain/money';
import { toChartSeries } from './chartSeries';
import { toDistributionFacets } from './distributionSeries';
import type { ReportChartData } from './reports.types';

// A report drawn as the chart that fits it: a ranked/stacked distribution
// or the debit/credit synthesis lines. `null` means its query hasn't
// resolved yet (the dashboard never passes null — it only renders once its
// own data has loaded). A `hidden` payload means the report matched no
// operations, which gets its own message rather than an empty chart.
// `title` isn't on ReportChartData itself, so callers that have it pass it in.
const props = defineProps<{
  report: ReportChartData | null;
  error?: boolean;
  title?: string;
}>();
const { t } = useI18n();

// A debit/credit report can combine more than one currency on one canvas.
const seriesAriaLabel = computed(() => {
  const report = props.report;
  if (report?.kind !== 'series') return '';
  const currencies = [...new Set(report.series.series.map((s) => s.currency))];
  if (currencies.length === 0) return props.title ?? '';
  return props.title ? `${props.title} (${currencies.join(', ')})` : currencies.join(', ');
});

const isHidden = computed(() => {
  const report = props.report;
  if (!report) return false;
  return report.kind === 'distribution' ? report.distribution.hidden : report.series.hidden;
});

const distributionFacets = computed(() => {
  const report = props.report;
  if (report?.kind !== 'distribution' || report.distribution.hidden) return null;
  return toDistributionFacets(report.distribution, t);
});

const seriesChart = computed(() => {
  const report = props.report;
  if (report?.kind !== 'series' || report.series.hidden) return null;
  return {
    series: toChartSeries(report.series, t),
    axisBounds: toDisplayBounds(report.series.axisBounds),
  };
});
</script>

<template>
  <LoadError v-if="error" data-testid="report-chart-error" />
  <p v-else-if="report === null" role="status" class="text-muted">{{ t('common.loading') }}</p>
  <p v-else-if="isHidden" class="text-muted" data-testid="report-chart-empty">
    {{ t('reports.noData') }}
  </p>
  <RankedChart v-else-if="distributionFacets" :facets="distributionFacets" :report-title="title" />
  <SynthesisChart
    v-else-if="seriesChart"
    :series="seriesChart.series"
    :axis-bounds="seriesChart.axisBounds"
    :label="seriesAriaLabel"
  />
</template>

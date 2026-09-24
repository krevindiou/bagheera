<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import RankedChart from '../../components/RankedChart.vue';
import SynthesisChart from '../../components/SynthesisChart.vue';
import { toChartSeries } from './chartSeries';
import { toDistributionFacets } from './distributionSeries';
import type { ReportChartData } from './reports.types';

// A report drawn as the chart that fits it: a ranked/stacked distribution
// or the debit/credit synthesis lines. `null` (still loading) and a
// `hidden` payload draw nothing — both charts already hide themselves when
// they have no data.
const props = defineProps<{ report: ReportChartData | null }>();
const { t } = useI18n();

const distributionFacets = computed(() => {
  const report = props.report;
  if (report?.kind !== 'distribution') return null;
  return report.distribution.hidden ? [] : toDistributionFacets(report.distribution, t);
});

const seriesChart = computed(() => {
  const report = props.report;
  if (report?.kind !== 'series') return null;
  if (report.series.hidden) return { series: [], axisBounds: null };
  return { series: toChartSeries(report.series, t), axisBounds: report.series.axisBounds };
});
</script>

<template>
  <RankedChart v-if="distributionFacets" :facets="distributionFacets" />
  <SynthesisChart
    v-else-if="seriesChart"
    :series="seriesChart.series"
    :axis-bounds="seriesChart.axisBounds"
  />
</template>

<script setup lang="ts">
import SynthesisChart, { type SynthesisChartSeries } from './SynthesisChart.vue';
import {
  SYNTHESIS_CHART_RANGE_LABEL_KEYS,
  SYNTHESIS_CHART_RANGES,
  type SynthesisChartRange,
} from './synthesisChartRange';

// A panel around SynthesisChart with the window selector (12 months / 24
// months / all time) in its header, optionally under a title. `range` is
// what the page sends to the API; `rangeTestid` names the select for the
// page's own tests. Attributes (a `data-testid`) land on the root.
defineProps<{
  series: SynthesisChartSeries[];
  axisBounds: { min: number; max: number } | null;
  rangeTestid: string;
  title?: string;
}>();
const range = defineModel<SynthesisChartRange>('range', { required: true });
</script>

<template>
  <section class="panel panel-lg mb-4 p-4">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 v-if="title" class="h6 mb-0">{{ title }}</h2>
      <select
        v-model="range"
        class="form-select form-select-sm w-auto ms-auto"
        :aria-label="$t('chartRange.label')"
        :data-testid="rangeTestid"
      >
        <option v-for="option in SYNTHESIS_CHART_RANGES" :key="option" :value="option">
          {{ $t(SYNTHESIS_CHART_RANGE_LABEL_KEYS[option]) }}
        </option>
      </select>
    </div>
    <SynthesisChart :series="series" :axis-bounds="axisBounds" />
  </section>
</template>

<script setup lang="ts">
// Decorative sparkline for the dashboard's account tiles: plain inline SVG,
// no axes or tooltip, cheap for a whole grid.
import { computed } from 'vue';

// `values` defaults to empty in case a response briefly lacks the history;
// the caller picks `color` (per currency).
const props = withDefaults(
  defineProps<{
    values?: number[];
    color?: string;
  }>(),
  { values: () => [], color: 'var(--violet-bright)' },
);

const WIDTH = 100;
const HEIGHT = 28;
// Vertical breathing room so a peak/trough doesn't touch the tile edges.
const PAD_Y = 3;

const linePoints = computed<[number, number][] | null>(() => {
  if (props.values.length < 2) return null;
  const min = Math.min(...props.values);
  const max = Math.max(...props.values);
  const range = max - min;
  const step = WIDTH / (props.values.length - 1);
  return props.values.map((value, i) => {
    const x = i * step;
    const y = range === 0 ? HEIGHT / 2 : PAD_Y + (HEIGHT - PAD_Y * 2) * (1 - (value - min) / range);
    return [x, y];
  });
});

const linePath = computed(() => {
  if (!linePoints.value) return '';
  return linePoints.value
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');
});

// The line closed down to the baseline, for the fill under it.
const areaPath = computed(() => {
  if (!linePoints.value) return '';
  const [firstX] = linePoints.value[0];
  const [lastX] = linePoints.value[linePoints.value.length - 1];
  return `${linePath.value} L${lastX.toFixed(2)},${HEIGHT} L${firstX.toFixed(2)},${HEIGHT} Z`;
});
</script>

<template>
  <svg
    v-if="linePoints"
    class="sparkline"
    :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <path :d="areaPath" :fill="color" fill-opacity="0.16" stroke="none" />
    <path
      :d="linePath"
      :stroke="color"
      fill="none"
      stroke-width="1.25"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<style scoped>
.sparkline {
  display: block;
  width: 100%;
  height: 28px;
}
</style>

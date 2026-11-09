<script lang="ts">
// Module scope, so it outlives each guest page's own AuthLayout: the intro
// plays on the first one only, not again on every sign-in ⇄ register hop.
let introPlayed = false;

function claimIntro(): boolean {
  const first = !introPlayed;
  introPlayed = true;
  return first;
}
</script>

<script setup lang="ts">
// A single streamgraph rising gently across the bottom of the page, its
// layers stacked edge to edge around a wavering centre line.
import { bandPath } from './smoothPath';
import type { Point } from './smoothPath';
import { tint } from './tint';

const intro = claimIntro();

const LAYERS = [
  { amp: 38, freq: 0.004, phase: 0.3, fill: tint(12) },
  { amp: 46, freq: 0.006, phase: 1.7, fill: tint(24) },
  { amp: 42, freq: 0.0035, phase: 3.1, fill: tint(36) },
  { amp: 32, freq: 0.007, phase: 4.4, fill: tint(18) },
];
const xs = Array.from({ length: 39 }, (_, i) => -40 + i * 40);
const thickness = (x: number, layer: (typeof LAYERS)[number]) =>
  layer.amp * (0.55 + 0.45 * Math.sin(x * layer.freq + layer.phase));
let edge: Point[] = xs.map((x) => {
  const total = LAYERS.reduce((sum, layer) => sum + thickness(x, layer), 0);
  return [x, 780 - x * 0.1 + 26 * Math.sin(x * 0.0028 + 0.5) - total / 2];
});
// Each band sits on the one above it: its top edge is the previous bottom.
const layers = LAYERS.map((layer, i) => {
  const below = edge.map(([x, y]): Point => [x, y + thickness(x, layer)]);
  const band = { key: i, d: bandPath(edge, below), fill: layer.fill };
  edge = below;
  return band;
});
</script>

<template>
  <svg
    viewBox="0 0 1440 900"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
    focusable="false"
    :class="{ intro }"
  >
    <path v-for="layer in layers" :key="layer.key" :d="layer.d" :fill="layer.fill" />
  </svg>
</template>

<style scoped>
/* The layers arrive as one block: animated one by one, their shared edges
   would slide past each other mid-way. */
@media (prefers-reduced-motion: no-preference) {
  .intro {
    animation: rise 1.4s cubic-bezier(0.4, 0, 0.2, 1) both;
  }
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
</style>

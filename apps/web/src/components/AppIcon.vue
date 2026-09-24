<script setup lang="ts">
import { computed } from 'vue';
import { ICONS, type IconName } from './appIcons';

// One stroked, decorative SVG glyph from the registry in appIcons.ts. It
// takes its color from the surrounding text; size it with `size` (px) or
// with CSS on a class/parent when the context already does. The accessible
// name belongs to the button or label around it, not the icon.
const props = defineProps<{ name: IconName; size?: number }>();

const icon = computed(() => ICONS[props.name]);
</script>

<template>
  <svg
    :viewBox="icon.viewBox"
    :width="size"
    :height="size"
    fill="none"
    stroke="currentColor"
    :stroke-width="icon.strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <component :is="shape.tag" v-for="(shape, i) in icon.shapes" :key="i" v-bind="shape.attrs" />
  </svg>
</template>

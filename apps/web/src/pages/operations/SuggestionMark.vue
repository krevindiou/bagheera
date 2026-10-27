<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue';

// A small history mark beside a field the page filled from the Member's
// earlier operations; the words are kept for the tooltip and screen readers.
defineProps<{ label: string }>();
</script>

<template>
  <span class="suggestion-mark text-muted" :title="label">
    <AppIcon name="clock" :size="14" />
    <span class="visually-hidden">{{ label }}</span>
  </span>
</template>

<style scoped>
.suggestion-mark {
  display: inline-flex;
  flex: none;
  align-items: center;
}
</style>

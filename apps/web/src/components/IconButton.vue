<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import type { IconName } from './appIcons';

// Compact icon-only action button (row-level Edit/Close/Delete/View/Remove).
// The action name is kept as the accessible name (aria-label) and hover
// tooltip (title) — only the visible text goes away. Keeps the
// `btn-outline-secondary`/`btn-outline-danger` classes so existing
// selectors/theming keyed off them still apply.

defineProps<{
  icon: IconName;
  label: string;
  danger?: boolean;
}>();
</script>

<template>
  <button
    type="button"
    class="btn btn-sm btn-icon"
    :class="danger ? 'btn-outline-danger' : 'btn-outline-secondary'"
    :title="label"
    :aria-label="label"
  >
    <AppIcon :name="icon" />
  </button>
</template>

<style scoped>
.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
}
.btn-icon svg {
  width: 16px;
  height: 16px;
}
</style>

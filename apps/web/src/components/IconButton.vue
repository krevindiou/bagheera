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

<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import type { IconName } from './appIcons';

// Icon-only row action button; `label` is its aria-label and title.

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

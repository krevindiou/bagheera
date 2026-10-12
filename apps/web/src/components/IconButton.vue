<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import type { IconName } from './appIcons';

// Icon-only row action button; `label` is its title (and aria-label by
// default). Pass `ariaLabel` to name the row it acts on, so a screen reader
// user tabbing through a list of rows hears which one each button targets.

defineProps<{
  icon: IconName;
  label: string;
  ariaLabel?: string;
  danger?: boolean;
  disabled?: boolean;
}>();
</script>

<template>
  <button
    type="button"
    class="btn btn-sm btn-icon"
    :class="danger ? 'btn-outline-danger' : 'btn-outline-secondary'"
    :disabled="disabled"
    :title="label"
    :aria-label="ariaLabel ?? label"
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

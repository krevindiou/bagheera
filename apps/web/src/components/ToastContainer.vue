<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useToast } from '../composables/useToast';

const { toasts, dismiss } = useToast();
const { t } = useI18n();

const variantClass: Record<string, string> = {
  success: 'toast-success',
  error: 'toast-error',
  info: 'toast-info',
};
</script>

<template>
  <!-- Fixed to the viewport corner rather than the page's own document
       flow — the old in-flow placement pushed page content down whenever
       a toast fired, and sat *behind* an open drawer's backdrop (a plain
       block has no stacking priority over a position:fixed one), making it
       invisible for anything triggered from inside a form drawer. -->
  <div v-if="toasts.length > 0" class="toast-container">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast-item"
      :class="variantClass[toast.variant]"
      role="alert"
    >
      <span class="toast-text">{{ toast.text }}</span>
      <button
        type="button"
        class="toast-close"
        :aria-label="t('common.cancel')"
        @click="dismiss(toast.id)"
      >
        ×
      </button>
    </div>
  </div>
</template>

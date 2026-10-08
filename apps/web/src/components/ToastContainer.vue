<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useToast } from '../composables/useToast';
import AppIcon from './AppIcon.vue';

const { toasts, dismiss } = useToast();
const { t } = useI18n();

const variantClass: Record<string, string> = {
  success: 'toast-success',
  error: 'toast-error',
  info: 'toast-info',
};
</script>

<template>
  <!-- Fixed, so it neither pushes content down nor hides behind a drawer's
       backdrop. -->
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
        :aria-label="t('common.close')"
        @click="dismiss(toast.id)"
      >
        <AppIcon name="close" :size="16" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Bottom-right: page header buttons occupy the top-right. Pinned to the
   bottom, the column grows upward, newest nearest the corner. */
.toast-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1100;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: min(360px, calc(100vw - 40px));
}
.toast-item {
  /* Bootstrap's .toast-container sets pointer-events: none, which would
     otherwise make the close button unclickable. */
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: var(--panel-2);
  border: 1px solid var(--hair-strong);
  border-left: 3px solid var(--paper-faint);
  border-radius: var(--bs-border-radius);
  box-shadow: var(--bs-box-shadow-sm);
  padding: 12px 14px;
  color: var(--paper);
  font-size: 14px;
}
.toast-success {
  border-left-color: var(--green);
}
.toast-error {
  border-left-color: var(--red);
}
.toast-info {
  border-left-color: var(--violet-bright);
}
.toast-text {
  flex: 1;
  line-height: 1.4;
}
.toast-close {
  flex: none;
  background: transparent;
  border: none;
  display: inline-flex;
  color: var(--paper-faint);
  line-height: 1;
  padding: 0;
  cursor: pointer;
}
.toast-close:hover {
  color: var(--paper);
}
</style>

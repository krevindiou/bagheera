<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useToast } from '../composables/useToast';
import AppIcon from './AppIcon.vue';

const { toasts, dismiss, pause, resume } = useToast();
const { t } = useI18n();

const variantClass: Record<string, string> = {
  success: 'toast-success',
  error: 'toast-error',
  info: 'toast-info',
};

// Only resume once focus has actually left the toast, not when it merely
// moves from one child (e.g. the text) to another (the close button).
function onFocusOut(id: number, event: FocusEvent) {
  const toastItem = event.currentTarget as HTMLElement;
  const next = event.relatedTarget as Node | null;
  if (!next || !toastItem.contains(next)) resume(id);
}
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
      @mouseenter="pause(toast.id)"
      @mouseleave="resume(toast.id)"
      @focusin="pause(toast.id)"
      @focusout="onFocusOut(toast.id, $event)"
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
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--text-faint);
  border-radius: var(--bs-border-radius);
  box-shadow: var(--shadow-float);
  padding: 12px 14px;
  color: var(--text);
  font-size: 14px;
}
.toast-success {
  border-left-color: var(--success);
}
.toast-error {
  border-left-color: var(--danger);
}
.toast-info {
  border-left-color: var(--text-muted);
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
  color: var(--text-faint);
  line-height: 1;
  padding: 0;
  cursor: pointer;
}
.toast-close:hover {
  color: var(--text);
}
</style>

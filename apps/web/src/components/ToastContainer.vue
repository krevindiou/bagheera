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
        :aria-label="t('common.close')"
        @click="dismiss(toast.id)"
      >
        <AppIcon name="close" :size="16" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Bottom-right, not top-right: every page header lives in that same
   top-right region (New operation / Search / Scheduled operations on
   Operations, the sidebar's own top-right proximity on narrower
   layouts, etc.), and a stack of toasts there visibly covered those
   buttons. Bottom-right is clear on every page/viewport this app has.
   Newest toast still ends up nearest the corner: items render in push
   order (oldest first) inside a column that grows upward as the
   bottom edge stays pinned. */
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
  /* .toast-container is also Bootstrap's own built-in class, which bakes
     in pointer-events:none (Bootstrap expects its .toast to restore
     :auto — see bootstrap.css) — without this, that :none inherits
     straight down through .toast-item/.toast-close and the close button
     (and the whole toast) silently stops receiving clicks. */
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

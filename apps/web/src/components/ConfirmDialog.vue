<script setup lang="ts">
import { ref, useId } from 'vue';
import { useEscapeKey } from '../composables/useEscapeKey';
import { useFocusTrap } from '../composables/useFocusTrap';

// Mounted only while a confirmation is pending (see ConfirmModal.vue), so
// useFocusTrap's mount/unmount lifecycle — capture, trap, restore — applies
// the same way it does for FormDrawer.
defineProps<{
  title?: string;
  body: string;
  confirmLabel?: string;
  danger: boolean;
}>();
const emit = defineEmits<{ confirm: []; cancel: [] }>();

const titleId = useId();
const bodyId = `${titleId}-body`;

const dialog = ref<HTMLElement | null>(null);
useEscapeKey(() => emit('cancel'));
useFocusTrap(dialog);
</script>

<template>
  <div class="modal d-block" tabindex="-1">
    <div
      ref="dialog"
      class="modal-dialog modal-dialog-centered"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :aria-describedby="bodyId"
    >
      <div class="modal-content">
        <div class="modal-header">
          <h2 :id="titleId" class="modal-title h5">{{ title ?? $t('common.confirmTitle') }}</h2>
        </div>
        <div :id="bodyId" class="modal-body">{{ body }}</div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn"
            :class="danger ? 'btn-danger' : 'btn-primary'"
            @click="emit('confirm')"
          >
            {{ confirmLabel ?? $t('common.ok') }}
          </button>
          <!-- Cancel is the safe default focus target for a destructive action. -->
          <button v-autofocus type="button" class="btn btn-secondary" @click="emit('cancel')">
            {{ $t('common.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
  <div class="modal-backdrop show"></div>
</template>

<style scoped>
.modal-content {
  --bs-modal-bg: var(--surface);
  --bs-modal-color: var(--text);
  --bs-modal-border-color: var(--border);
  box-shadow: var(--bs-box-shadow);
}
.modal-header,
.modal-footer {
  border-color: var(--border);
}
</style>

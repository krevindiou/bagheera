<script setup lang="ts">
import { useConfirm } from '../composables/useConfirm';
import { useEscapeKey } from '../composables/useEscapeKey';

const { state, settle } = useConfirm();

// Unlike the drawers, this component is always mounted (see BaseLayout) —
// its own visibility toggles via state.visible, so the callback guards on
// that instead of relying on mount/unmount.
useEscapeKey(() => {
  if (state.visible) settle(false);
});
</script>

<template>
  <div v-if="state.visible" class="modal d-block" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-dialog-centered" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ $t('common.confirmTitle') }}</h5>
        </div>
        <div class="modal-body">{{ $t('common.confirmBody') }}</div>
        <div class="modal-footer">
          <button type="button" class="btn btn-primary" @click="settle(true)">
            {{ $t('common.ok') }}
          </button>
          <button type="button" class="btn btn-secondary" @click="settle(false)">
            {{ $t('common.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
  <div v-if="state.visible" class="modal-backdrop show"></div>
</template>

<style scoped>
.modal-content {
  --bs-modal-bg: var(--panel);
  --bs-modal-color: var(--paper);
  --bs-modal-border-color: var(--hair-strong);
  box-shadow: var(--bs-box-shadow);
}
.modal-header,
.modal-footer {
  border-color: var(--hair);
}
</style>

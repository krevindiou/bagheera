<script setup lang="ts">
import { useConfirm } from '../composables/useConfirm';
import ConfirmDialog from './ConfirmDialog.vue';

const { state, settle } = useConfirm();
</script>

<template>
  <!-- Mounted in BaseLayout regardless of state.visible; ConfirmDialog itself
       mounts/unmounts with it so its focus trap (capture on setup, restore on
       unmount) runs correctly each time a confirmation opens and closes. -->
  <ConfirmDialog
    v-if="state.visible"
    :title="state.options?.title"
    :body="state.options?.body ?? ''"
    :confirm-label="state.options?.confirmLabel"
    :danger="state.options?.danger ?? false"
    @confirm="settle(true)"
    @cancel="settle(false)"
  />
</template>

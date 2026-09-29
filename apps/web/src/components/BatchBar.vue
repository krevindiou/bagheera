<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useConfirm } from '../composables/useConfirm';
import { useToast } from '../composables/useToast';

export interface BatchAction {
  // i18n keys, resolved here so a live locale switch relabels the bar.
  labelKey: string;
  successKey: string;
  // Toasted when the request fails, or succeeds without changing anything.
  errorKey: string;
  testid: string;
  danger?: boolean;
  // Sends the batch request for these ids; resolves to how many rows it
  // changed, or null when the request itself failed.
  run: (ids: string[]) => Promise<number | null>;
}

// The fixed bar a batch-selectable list (operations, schedulers, reports)
// shows while rows are checked: one button per action, each confirming,
// running its request and toasting the outcome the same way. `done` means
// the server may have changed rows and the list should reload. Attributes
// (the list's own `data-testid`) land on the bar.
const props = defineProps<{ selectedIds: string[]; actions: BatchAction[] }>();
const emit = defineEmits<{ done: [] }>();

const { confirm } = useConfirm();
const { push: toast } = useToast();
const { t } = useI18n();

async function perform(action: BatchAction) {
  if (!(await confirm())) return;

  const count = await action.run(props.selectedIds);
  if (count === null) {
    toast(t(action.errorKey), 'error');
    return;
  }
  // The server silently skips ids it won't touch (someone else's, or no
  // longer changeable — see each batch.service.ts) and still answers 200,
  // so a zero count means nothing changed: don't claim success, but still
  // reload.
  if (count === 0) {
    toast(t(action.errorKey), 'error');
  } else {
    toast(t(action.successKey), 'success');
  }
  emit('done');
}
</script>

<template>
  <div v-if="selectedIds.length > 0" class="batch-bar">
    <button
      v-for="action in actions"
      :key="action.testid"
      type="button"
      class="btn btn-sm"
      :class="action.danger ? 'btn-outline-danger' : 'btn-outline-secondary'"
      :data-testid="action.testid"
      @click="perform(action)"
    >
      {{ $t(action.labelKey) }}
    </button>
  </div>
</template>

<style scoped>
/* Fixed and centered rather than an in-flow row — an in-flow row toggling
   in/out with the selection (mb-3 and all) pushed the table down by its own
   height the moment a row got checked (same class of bug as the schedulers
   "New scheduler" button hiding under showForm — see SchedulersPage.vue). */
.batch-bar {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 1040;
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--panel-2);
  border: 1px solid var(--hair-strong);
  border-radius: 8px;
  box-shadow: var(--bs-box-shadow);
  padding: 10px 16px;
}
</style>

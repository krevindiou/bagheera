<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AppIcon from './AppIcon.vue';
import BottomBar from './BottomBar.vue';
import type { IconName } from './appIcons';
import { useConfirm } from '../composables/useConfirm';
import { useToast } from '../composables/useToast';

export interface BatchAction {
  // i18n keys, resolved here so a live locale switch relabels the bar.
  labelKey: string;
  successKey: string;
  // Toasted when the request fails, or succeeds without changing anything.
  errorKey: string;
  // Confirmation body, pluralized on the selection size ({count}). A function
  // picks the key from the selected ids, for a body that depends on them.
  confirmKey: string | ((ids: string[]) => string);
  // The confirm button's label; also red when `danger` is set.
  confirmLabelKey: string;
  icon: IconName;
  testid: string;
  danger?: boolean;
  // Sends the batch request for these ids; resolves to how many rows it
  // changed, or null when the request itself failed.
  run: (ids: string[]) => Promise<number | null>;
}

// The bar pinned to the bottom that a batch-selectable list (operations, schedulers, reports)
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
  const selected = props.selectedIds.length;
  const confirmKey =
    typeof action.confirmKey === 'function'
      ? action.confirmKey(props.selectedIds)
      : action.confirmKey;
  const confirmed = await confirm({
    body: t(confirmKey, selected),
    confirmLabel: t(action.confirmLabelKey),
    danger: action.danger,
  });
  if (!confirmed) return;

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
  <BottomBar v-if="selectedIds.length > 0">
    <span role="status" class="batch-bar-count">{{
      $t('common.selectedCount', selectedIds.length)
    }}</span>
    <div class="d-flex flex-wrap gap-2">
      <button
        v-for="action in actions"
        :key="action.testid"
        type="button"
        class="btn btn-sm d-inline-flex align-items-center gap-2"
        :class="action.danger ? 'btn-outline-danger' : 'btn-outline-secondary'"
        :data-testid="action.testid"
        @click="perform(action)"
      >
        <AppIcon :name="action.icon" :size="14" />
        {{ $t(action.labelKey) }}
      </button>
    </div>
  </BottomBar>
</template>

<style scoped>
.batch-bar-count {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
</style>

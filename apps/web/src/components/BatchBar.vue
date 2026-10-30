<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
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

// Toasts share the bottom edge; publishing the bar's live height (it wraps
// to two rows on narrow screens) lets ToastContainer stack above it.
const HEIGHT_VAR = '--batch-bar-height';
const bar = ref<HTMLElement | null>(null);
let observer: ResizeObserver | undefined;

function stopPublishingHeight() {
  observer?.disconnect();
  observer = undefined;
  document.documentElement.style.removeProperty(HEIGHT_VAR);
}

watch(bar, (element) => {
  stopPublishingHeight();
  if (!element) return;
  observer = new ResizeObserver(() => {
    document.documentElement.style.setProperty(HEIGHT_VAR, `${element.offsetHeight}px`);
  });
  observer.observe(element);
});
onBeforeUnmount(stopPublishingHeight);

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
  <div v-if="selectedIds.length > 0" ref="bar" class="batch-bar">
    <div class="batch-bar-inner">
      <span role="status" class="batch-bar-count">{{
        $t('common.selectedCount', selectedIds.length)
      }}</span>
      <div class="d-flex flex-wrap gap-2">
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
    </div>
  </div>
</template>

<style scoped>
/* Fixed rather than an in-flow row — an in-flow row toggling in/out with
   the selection pushed the table down by its own height the moment a row
   got checked. Spans the content area only, so the sidebar's account menu
   stays reachable; the inner row follows the page's content column (see
   the variables on BaseLayout's .app-shell) so the count and actions line
   up with the table edges. */
.batch-bar {
  position: fixed;
  left: var(--sidebar-width, 0px);
  right: 0;
  bottom: 0;
  z-index: 1040;
  background: var(--surface);
  border-top: 1px solid var(--border);
  box-shadow: 0 -8px 24px -12px rgba(28, 25, 23, 0.14);
}
.batch-bar-inner {
  max-width: var(--content-max, none);
  margin: 0 auto;
  padding: 12px var(--content-gutter, 16px);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}
.batch-bar-count {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
</style>

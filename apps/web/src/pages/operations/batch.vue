<script setup lang="ts">
import { apiClient } from '../../api/client';
import BatchBar, { type BatchAction } from '../../components/BatchBar.vue';
import type { Operation } from '../../domain/referenceData';
import { deleteConfirmKey } from './deleteConfirm';

// `operations` are the rows the ids are picked from, to tell transfers apart.
const props = defineProps<{ selectedIds: string[]; operations: Operation[] }>();
const emit = defineEmits<{ done: [] }>();

const actions: BatchAction[] = [
  {
    labelKey: 'operations.batch.delete',
    successKey: 'operations.batch.deleted',
    errorKey: 'operations.genericError',
    confirmKey: (ids) => {
      const selected = new Set(ids);
      return deleteConfirmKey(props.operations.filter(({ id }) => selected.has(id)));
    },
    confirmLabelKey: 'common.delete',
    icon: 'trash',
    testid: 'batch-delete',
    danger: true,
    async run(ids) {
      const { data, response } = await apiClient.POST('/operations/batch/delete', {
        body: { ids },
      });
      if (!response.ok) return null;
      return data?.deletedCount ?? 0;
    },
  },
  {
    labelKey: 'operations.batch.reconcile',
    successKey: 'operations.batch.reconciled',
    errorKey: 'operations.genericError',
    confirmKey: 'operations.batch.confirmReconcile',
    confirmLabelKey: 'operations.batch.reconcileConfirmLabel',
    icon: 'check',
    testid: 'batch-reconcile',
    async run(ids) {
      const { data, response } = await apiClient.POST('/operations/batch/reconcile', {
        body: { ids },
      });
      if (!response.ok) return null;
      return data?.reconciledCount ?? 0;
    },
  },
];
</script>

<template>
  <BatchBar
    :selected-ids="selectedIds"
    :actions="actions"
    data-testid="batch-actions"
    @done="emit('done')"
  />
</template>

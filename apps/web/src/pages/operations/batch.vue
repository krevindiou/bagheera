<script setup lang="ts">
import { apiClient } from '../../api/client';
import BatchBar, { type BatchAction } from '../../components/BatchBar.vue';

defineProps<{ selectedIds: string[] }>();
const emit = defineEmits<{ done: [] }>();

const actions: BatchAction[] = [
  {
    labelKey: 'operations.batch.delete',
    successKey: 'operations.batch.deleted',
    errorKey: 'operations.genericError',
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

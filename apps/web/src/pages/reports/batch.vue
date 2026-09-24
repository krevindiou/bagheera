<script setup lang="ts">
import { apiClient } from '../../api/client';
import BatchBar, { type BatchAction } from '../../components/BatchBar.vue';

defineProps<{ selectedIds: string[] }>();
const emit = defineEmits<{ done: [] }>();

const actions: BatchAction[] = [
  {
    labelKey: 'reports.batch.delete',
    successKey: 'reports.batch.deleted',
    errorKey: 'reports.genericError',
    testid: 'report-batch-delete',
    danger: true,
    async run(ids) {
      const { data, response } = await apiClient.POST('/reports/batch/delete', {
        body: { ids },
      });
      if (!response.ok) return null;
      return (data as { deletedCount?: number } | undefined)?.deletedCount ?? 0;
    },
  },
];
</script>

<template>
  <BatchBar
    :selected-ids="selectedIds"
    :actions="actions"
    data-testid="report-batch-actions"
    @done="emit('done')"
  />
</template>

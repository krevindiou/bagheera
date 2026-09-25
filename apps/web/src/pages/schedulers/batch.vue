<script setup lang="ts">
import { apiClient } from '../../api/client';
import BatchBar, { type BatchAction } from '../../components/BatchBar.vue';

defineProps<{ selectedIds: string[] }>();
const emit = defineEmits<{ done: [] }>();

const actions: BatchAction[] = [
  {
    labelKey: 'schedulers.batch.delete',
    successKey: 'schedulers.batch.deleted',
    errorKey: 'schedulers.genericError',
    testid: 'scheduler-batch-delete',
    danger: true,
    async run(ids) {
      const { data, response } = await apiClient.POST('/schedulers/batch/delete', {
        body: { ids },
      });
      if (!response.ok) return null;
      return data?.deletedCount ?? 0;
    },
  },
];
</script>

<template>
  <BatchBar
    :selected-ids="selectedIds"
    :actions="actions"
    data-testid="scheduler-batch-actions"
    @done="emit('done')"
  />
</template>

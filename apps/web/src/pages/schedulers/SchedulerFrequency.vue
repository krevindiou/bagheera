<script setup lang="ts">
import { formatDate } from '../../domain/money';
import type { Scheduler } from './schedulers.types';

// One source for the frequency text: the table shows it in its own column from
// `md` up and under the third party below it.
defineProps<{ scheduler: Pick<Scheduler, 'frequencyValue' | 'frequencyUnit' | 'limitDate'> }>();
</script>

<template>
  {{ $t(`schedulers.frequency.${scheduler.frequencyUnit}`, { count: scheduler.frequencyValue }) }}
  <div v-if="scheduler.limitDate" class="text-muted small">
    {{ $t('schedulers.until', { date: formatDate(scheduler.limitDate) }) }}
  </div>
</template>

<script setup lang="ts">
import StatusIcon from '../../components/StatusIcon.vue';

// One source for an operation's status badges: the table shows them in their
// own column from `md` up and inline in the third-party cell below it.
defineProps<{ reconciled: boolean; generated: boolean }>();
</script>

<template>
  <StatusIcon v-if="reconciled" kind="reconciled" :label="$t('operations.reconciled')" />
  <StatusIcon v-if="generated" kind="scheduler" :label="$t('operations.generatedByScheduler')" />
</template>

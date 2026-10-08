<script setup lang="ts">
import LoadError from './LoadError.vue';

// The three-way branch every list page opens with: the load-error alert,
// else a muted "nothing here" line, else the content (default slot).
// `error-testid` goes on the alert so each page keeps its own test id.
defineProps<{ error: boolean; empty: boolean; emptyText: string; errorTestid?: string }>();
</script>

<template>
  <LoadError v-if="error" :data-testid="errorTestid" />
  <p v-else-if="empty" class="text-muted">{{ emptyText }}</p>
  <slot v-else />
</template>

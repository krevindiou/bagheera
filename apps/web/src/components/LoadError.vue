<script setup lang="ts">
// The "couldn't load this" alert shared by every page that fetches data.
// `role="alert"` makes a failed load announced to screen readers.
// Attributes (`data-testid`, classes) land on the root.
</script>

<template>
  <div class="alert alert-danger" role="alert">{{ $t('common.loadError') }}</div>
</template>

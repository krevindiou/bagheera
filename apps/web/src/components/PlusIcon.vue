<script setup lang="ts">
// Shared "+" glyph for primary "New/Add X" buttons — keeps stroke style in
// sync with IconButton's action icons instead of each page inlining its own.
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
</template>

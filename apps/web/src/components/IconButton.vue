<script setup lang="ts">
// Compact icon-only action button (row-level Edit/Close/Delete/View/Remove).
// The action name is kept as the accessible name (aria-label) and hover
// tooltip (title) — only the visible text goes away. Keeps the
// `btn-outline-secondary`/`btn-outline-danger` classes so existing
// selectors/theming keyed off them still apply.
type IconName = 'edit' | 'archive' | 'trash' | 'view' | 'hide';

defineProps<{
  icon: IconName;
  label: string;
  danger?: boolean;
}>();
</script>

<template>
  <button
    type="button"
    class="btn btn-sm btn-icon"
    :class="danger ? 'btn-outline-danger' : 'btn-outline-secondary'"
    :title="label"
    :aria-label="label"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <template v-if="icon === 'edit'">
        <path d="M4 20h4L20 8l-4-4L4 16v4Z" />
        <path d="M13.5 6.5l4 4" />
      </template>
      <template v-else-if="icon === 'archive'">
        <rect x="3" y="4" width="18" height="4" rx="1" />
        <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
        <path d="M10 13h4" />
      </template>
      <template v-else-if="icon === 'trash'">
        <path d="M4 7h16" />
        <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
        <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </template>
      <template v-else-if="icon === 'view'">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </template>
      <template v-else-if="icon === 'hide'">
        <path d="M3 3l18 18" />
        <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.1 4.1" />
        <path d="M6.2 6.2A17.9 17.9 0 0 0 2 12s3.5 7 10 7a10.4 10.4 0 0 0 4.2-.9" />
        <path d="M9.5 9.7a3 3 0 0 0 4.2 4.2" />
      </template>
    </svg>
  </button>
</template>

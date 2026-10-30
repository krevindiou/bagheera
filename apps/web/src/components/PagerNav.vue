<script setup lang="ts">
import { computed } from 'vue';

// "Page X of Y", then Previous / Next, for a server-paginated list. `page` is the
// page currently shown; `update:page` asks the parent to load another one.
const props = defineProps<{ page: number; total: number; pageSize: number }>();
const emit = defineEmits<{ 'update:page': [page: number] }>();

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));

function goTo(page: number) {
  if (page < 1 || page > pageCount.value) return;
  emit('update:page', page);
}
</script>

<template>
  <nav
    class="pager d-flex justify-content-between align-items-center gap-2 mt-3"
    :aria-label="$t('common.pager.label')"
  >
    <span class="pager-status">{{ $t('common.pager.status', { page, pageCount }) }}</span>
    <div class="d-flex gap-2">
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        :disabled="page <= 1"
        @click="goTo(page - 1)"
      >
        {{ $t('common.pager.previous') }}
      </button>
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        :disabled="page >= pageCount"
        @click="goTo(page + 1)"
      >
        {{ $t('common.pager.next') }}
      </button>
    </div>
  </nav>
</template>

<style scoped>
.pager-status {
  font-size: 13px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
</style>

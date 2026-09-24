<script setup lang="ts">
import { computed } from 'vue';

// Previous / "Page X of Y" / Next for a server-paginated list. `page` is the
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
  <nav class="pager d-flex align-items-center gap-2 mt-3" :aria-label="$t('common.pager.label')">
    <button
      type="button"
      class="btn btn-sm btn-outline-secondary"
      :disabled="page <= 1"
      @click="goTo(page - 1)"
    >
      {{ $t('common.pager.previous') }}
    </button>
    <span>{{ $t('common.pager.status', { page, pageCount }) }}</span>
    <button
      type="button"
      class="btn btn-sm btn-outline-secondary"
      :disabled="page >= pageCount"
      @click="goTo(page + 1)"
    >
      {{ $t('common.pager.next') }}
    </button>
  </nav>
</template>

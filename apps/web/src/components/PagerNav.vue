<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { pagerItems } from './pagerItems';

// "Page X of Y", then Previous, the page numbers (a window around the
// current page, with gaps), Next, for a server-paginated list. `page` is the
// page currently shown; `update:page` asks the parent to load another one.
const props = defineProps<{ page: number; total: number; pageSize: number }>();
const emit = defineEmits<{ 'update:page': [page: number] }>();

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
const items = computed(() => pagerItems(props.page, pageCount.value));

const nav = ref<HTMLElement | null>(null);

// Rows differ in height from one page to the next, so when the new page
// lands the buttons would slide away from the cursor. The browser's own
// scroll anchoring can't be relied on to prevent it: it latches onto the
// first element in view, which is often something above the list. So
// remember where the pager was and scroll by however far it moved.
let anchor: { page: number; top: number } | null = null;

function goTo(page: number) {
  if (page < 1 || page > pageCount.value || page === props.page) return;
  if (nav.value) anchor = { page, top: nav.value.getBoundingClientRect().top };
  emit('update:page', page);
}

watch(
  () => props.page,
  (page) => {
    if (!anchor || anchor.page !== page || !nav.value) return;
    const moved = nav.value.getBoundingClientRect().top - anchor.top;
    anchor = null;
    // 'instant': the page's CSS smooth scrolling would animate the fix.
    if (moved !== 0) window.scrollBy({ top: moved, behavior: 'instant' });
  },
  { flush: 'post' },
);
</script>

<template>
  <nav
    ref="nav"
    class="pager d-flex justify-content-between align-items-center gap-2 mt-3"
    :aria-label="$t('common.pager.label')"
  >
    <span class="pager-status">{{ $t('common.pager.status', { page, pageCount }) }}</span>
    <div class="pager-buttons d-flex flex-wrap justify-content-end gap-2">
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        :disabled="page <= 1"
        @click="goTo(page - 1)"
      >
        {{ $t('common.pager.previous') }}
      </button>
      <template v-for="(item, index) in items" :key="item === 'gap' ? `gap-${index}` : item">
        <span v-if="item === 'gap'" class="pager-gap" aria-hidden="true">…</span>
        <button
          v-else
          type="button"
          class="btn btn-sm pager-page"
          :class="item === page ? 'btn-primary' : 'btn-outline-secondary'"
          :aria-label="$t('common.pager.goTo', { page: item })"
          :aria-current="item === page ? 'page' : undefined"
          @click="goTo(item)"
        >
          {{ item }}
        </button>
      </template>
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
.pager-page {
  min-width: 32px;
  font-variant-numeric: tabular-nums;
}

.pager-gap {
  align-self: center;
  min-width: 16px;
  text-align: center;
  color: var(--text-faint);
}

.pager-status {
  font-size: 13px;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
</style>

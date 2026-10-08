import { computed, ref } from 'vue';

/**
 * Row selection for a batch-actions table: a `Set` for the template's
 * checks and an array for the API. Clearing it is each page's job.
 */
export function useSelection() {
  const selectedIds = ref<Set<string>>(new Set());
  const selectedIdList = computed(() => Array.from(selectedIds.value));

  function toggleSelected(id: string) {
    const next = new Set(selectedIds.value);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    selectedIds.value = next;
  }

  return { selectedIds, selectedIdList, toggleSelected };
}

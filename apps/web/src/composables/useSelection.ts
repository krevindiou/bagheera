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

  // The header checkbox's own click: selects every id passed (the current
  // page's selectable rows), or clears the selection once they all already are.
  function toggleAll(ids: string[]) {
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.value.has(id));
    selectedIds.value = allSelected ? new Set() : new Set(ids);
  }

  // The header checkbox's own checked/indeterminate state for those same ids.
  function allSelectState(ids: string[]): { checked: boolean; indeterminate: boolean } {
    const selectedCount = ids.filter((id) => selectedIds.value.has(id)).length;
    return {
      checked: ids.length > 0 && selectedCount === ids.length,
      indeterminate: selectedCount > 0 && selectedCount < ids.length,
    };
  }

  return { selectedIds, selectedIdList, toggleSelected, toggleAll, allSelectState };
}

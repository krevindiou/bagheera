import { computed, ref } from "vue";

/**
 * Row-selection state for a batch-actions table (operations/reports/
 * schedulers pages all use this exact shape). Exposes the selection both as
 * a `Set` (O(1) `.has()` checks for a row's checked state in the template)
 * and as a plain array (`selectedIdList` — batch-action API calls take a
 * list, not a Set). Each page still owns clearing the selection on its own
 * reload/refetch (that trigger differs per page), so this only covers the
 * toggle itself.
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

import { computed, ref, watch, type Ref } from 'vue';
import type { Preview, PreviewRow } from './import.types';
import type { ImportChoices } from './useImportChoices';

export type RowFilter = 'all' | PreviewRow['status'] | 'attention';

export const ROW_FILTERS: RowFilter[] = ['all', 'import', 'skipped', 'invalid', 'attention'];

export const PREVIEW_PAGE_SIZE = 50;

/**
 * Which rows of the preview the page shows: the filter, the page of that
 * filter, and the row being edited. A new file or preview (`viewReset`) starts
 * them over.
 */
export function useImportRows(
  preview: Readonly<Ref<Preview | null>>,
  included: Readonly<Ref<Set<number>>>,
  choices: ImportChoices,
  viewReset: Readonly<Ref<number>>,
) {
  const filter = ref<RowFilter>('all');
  const page = ref(1);
  const editingLine = ref<number | null>(null);

  watch(filter, () => {
    page.value = 1;
  });

  watch(viewReset, () => {
    filter.value = 'all';
    page.value = 1;
    editingLine.value = null;
  });

  // A row needs attention when it is invalid, or will be imported without a
  // category.
  function needsAttention(row: PreviewRow): boolean {
    if (row.status === 'invalid') return true;
    return (
      (row.status === 'import' || included.value.has(row.line)) && choices.shownCategory(row) === ''
    );
  }

  const filterCounts = computed<Record<RowFilter, number>>(() => {
    const rows = preview.value?.rows ?? [];
    return {
      all: rows.length,
      import: preview.value?.importCount ?? 0,
      skipped: preview.value?.skippedCount ?? 0,
      invalid: preview.value?.invalidCount ?? 0,
      attention: rows.filter(needsAttention).length,
    };
  });

  const filteredRows = computed(() =>
    (preview.value?.rows ?? []).filter((row) => {
      if (filter.value === 'all') return true;
      return filter.value === 'attention' ? needsAttention(row) : row.status === filter.value;
    }),
  );

  const pageRows = computed(() =>
    filteredRows.value.slice((page.value - 1) * PREVIEW_PAGE_SIZE, page.value * PREVIEW_PAGE_SIZE),
  );

  return { filter, page, editingLine, filterCounts, filteredRows, pageRows };
}

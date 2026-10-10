import type { EntryType } from '@bagheera/reference-data';
import { ref, watch, type Ref } from 'vue';
import { apiClient } from '../api/client';

export interface ThirdPartySuggestion {
  thirdParty: string;
  categoryId: string | null;
}

/**
 * Debounced third-party autocomplete (2+ characters, 300ms), reporting an
 * exact match's category via `onExactMatch` so the caller can prefill it.
 */
export function useThirdPartyAutocomplete(
  thirdParty: Ref<string | undefined>,
  type: Ref<EntryType>,
  onExactMatch: (categoryId: string) => void,
) {
  const suggestions = ref<ThirdPartySuggestion[]>([]);
  let debounceHandle: ReturnType<typeof setTimeout> | undefined;

  watch(thirdParty, (value) => {
    if (debounceHandle) clearTimeout(debounceHandle);
    const query = value?.trim() ?? '';
    if (query.length < 2) {
      suggestions.value = [];
      return;
    }
    debounceHandle = setTimeout(async () => {
      const { data } = await apiClient.GET('/operations/autocomplete', {
        params: { query: { q: query, type: type.value } },
      });
      suggestions.value = data ?? [];
      const exact = suggestions.value.find(
        (s) => s.thirdParty.toLowerCase() === query.toLowerCase(),
      );
      if (exact?.categoryId) {
        onExactMatch(exact.categoryId);
      }
    }, 300);
  });

  return { suggestions };
}

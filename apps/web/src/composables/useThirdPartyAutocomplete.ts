import { FIELD_LIMITS, type EntryType } from '@bagheera/reference-data';
import { onScopeDispose, ref, watch, type Ref } from 'vue';
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
  // Bumped on every query; a response only applies if it's still current,
  // so a stale response can't clobber a newer one or re-fire onExactMatch.
  let querySequence = 0;

  watch(thirdParty, (value) => {
    if (debounceHandle) clearTimeout(debounceHandle);
    const query = value?.trim() ?? '';
    const currentQuery = ++querySequence;
    // A pasted value can exceed the field's maxlength before the DOM
    // truncates it; the API would reject such a query anyway.
    if (query.length < 2 || query.length > FIELD_LIMITS.THIRD_PARTY) {
      suggestions.value = [];
      return;
    }
    debounceHandle = setTimeout(async () => {
      let data: ThirdPartySuggestion[] | undefined;
      try {
        ({ data } = await apiClient.GET('/operations/autocomplete', {
          params: { query: { q: query, type: type.value } },
        }));
      } catch {
        data = undefined;
      }
      if (currentQuery !== querySequence) return;
      suggestions.value = data ?? [];
      const exact = suggestions.value.find(
        (s) => s.thirdParty.toLowerCase() === query.toLowerCase(),
      );
      if (exact?.categoryId) {
        onExactMatch(exact.categoryId);
      }
    }, 300);
  });

  onScopeDispose(() => {
    if (debounceHandle) clearTimeout(debounceHandle);
  });

  return { suggestions };
}

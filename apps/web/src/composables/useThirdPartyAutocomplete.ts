import { ref, watch, type Ref } from "vue";
import { apiClient } from "../api/client";

export interface ThirdPartySuggestion {
  thirdParty: string;
  categoryId: number | null;
}

/**
 * Debounced third-party autocomplete: queries once the field holds at
 * least 2 characters, 300ms after the member stops typing, and reports an
 * exact match's category back via `onExactMatch` so the caller can
 * prefill it. Doesn't own the datalist's focus-on-pick behavior — that's
 * bound to a DOM ref declared in each form's own template, so it stays
 * there rather than being forced into this composable's interface.
 */
export function useThirdPartyAutocomplete(
  thirdParty: Ref<string | undefined>,
  type: Ref<"debit" | "credit">,
  onExactMatch: (categoryId: number) => void,
) {
  const suggestions = ref<ThirdPartySuggestion[]>([]);
  let debounceHandle: ReturnType<typeof setTimeout> | undefined;

  watch(thirdParty, (value) => {
    if (debounceHandle) clearTimeout(debounceHandle);
    const query = value?.trim() ?? "";
    if (query.length < 2) {
      suggestions.value = [];
      return;
    }
    debounceHandle = setTimeout(async () => {
      const { data } = await apiClient.GET("/operations/autocomplete", {
        params: { query: { q: query, type: type.value } },
      });
      suggestions.value = (data as ThirdPartySuggestion[] | undefined) ?? [];
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

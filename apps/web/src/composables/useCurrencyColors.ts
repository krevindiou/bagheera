import { computed } from 'vue';
import { ACCENT_COLOR, colorForCurrency } from '../components/chartColors';
import { useAccountsQuery } from './useReferenceQueries';

/**
 * Picks a currency's chart color: the theme's accent for the member's main
 * currency (the one on the most accounts, the first alphabetically on a
 * tie), the per-currency palette color for the others. Decided from the
 * member's accounts, not from one chart's series, so a currency keeps its
 * color from page to page.
 */
export function useCurrencyColors(): (currency: string) => string {
  const { accounts } = useAccountsQuery();
  const mainCurrency = computed(() => {
    const counts = new Map<string, number>();
    for (const { currency } of accounts.value) {
      counts.set(currency, (counts.get(currency) ?? 0) + 1);
    }
    const ranked = [...counts].sort(
      ([a, countA], [b, countB]) => countB - countA || a.localeCompare(b),
    );
    return ranked[0]?.[0];
  });
  return (currency) =>
    currency === mainCurrency.value ? ACCENT_COLOR : colorForCurrency(currency);
}

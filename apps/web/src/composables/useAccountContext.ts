import { computed, type Ref } from 'vue';
import { useAccountsQuery, useBanksQuery } from './useReferenceQueries';

// The account a page is scoped to, with its bank and currency. "Fully
// active": neither the account nor its bank is closed or deleted. Deleted
// accounts are unreachable (routing/the accounts query already exclude
// them), so only the closed flags matter here. `currency` falls back to USD
// until the account has loaded.
export function useAccountContext(accountId: Ref<string>) {
  const { accounts } = useAccountsQuery();
  const { banks } = useBanksQuery();

  const account = computed(() => accounts.value.find((a) => a.id === accountId.value) ?? null);
  const bank = computed(() => banks.value.find((b) => b.id === account.value?.bankId) ?? null);
  const isFullyActive = computed(
    () => !!account.value && !account.value.closed && !!bank.value && !bank.value.closed,
  );
  const currency = computed(() => account.value?.currency ?? 'USD');

  return { account, bank, isFullyActive, currency };
}

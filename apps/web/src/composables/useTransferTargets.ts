import { computed } from "vue";
import { currencySymbol } from "../pages/operations/money";
import type { Account, Bank } from "../pages/accounts/accounts.types";

/**
 * Transfer-target choices for an operation-like form: the member's other
 * fully active accounts (account and bank neither closed nor deleted)
 * sharing the source account's currency, plus — when editing a row whose
 * stored transfer account has since gone inactive — that stored account
 * kept selectable so the pair can be preserved, retargeted, or unlinked.
 * `amountCurrencySymbol` rides along since it's derived from the same
 * source-account lookup.
 */
export function useTransferTargets(
  accountId: () => number,
  accounts: () => Account[],
  banks: () => Bank[],
  currentTransferAccountId: () => number | null | undefined,
) {
  const sourceCurrency = computed(() => accounts().find((a) => a.id === accountId())?.currency);
  const bankById = computed(() => new Map(banks().map((b) => [b.id, b])));
  function isFullyActiveAccount(a: Account): boolean {
    return !a.closed && !(bankById.value.get(a.bankId)?.closed ?? false);
  }
  const transferTargets = computed(() => {
    const eligible = accounts().filter(
      (a) => a.id !== accountId() && a.currency === sourceCurrency.value && isFullyActiveAccount(a),
    );
    const storedTargetId = currentTransferAccountId();
    if (storedTargetId && !eligible.some((a) => a.id === storedTargetId)) {
      const stored = accounts().find((a) => a.id === storedTargetId);
      if (stored) eligible.push(stored);
    }
    return eligible;
  });
  const amountCurrencySymbol = computed(() =>
    sourceCurrency.value ? currencySymbol(sourceCurrency.value) : "",
  );

  return { sourceCurrency, transferTargets, amountCurrencySymbol };
}

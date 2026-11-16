<script setup lang="ts">
import { toMinorUnits } from '@bagheera/money';
import StatCard from '../../components/StatCard.vue';
import { formatMoney } from '../../domain/money';
import type { AccountFigures } from './importRows';

// The account's balance and reconciled balance as the confirmation would leave
// them, each with what it is now.
defineProps<{
  // Major units, as the account stands now.
  current: AccountFigures;
  // Minor units, once the import is confirmed with the choices made.
  projected: AccountFigures;
  currency: string;
}>();
</script>

<template>
  <section class="mb-4" data-testid="import-account-after">
    <h2 class="h6">{{ $t('operations.import.account.title') }}</h2>
    <div class="account-grid">
      <StatCard
        :label="$t('operations.balance')"
        :amount="projected.balance"
        :currency="currency"
        value-testid="import-after-balance"
        data-testid="import-after-balance-card"
      >
        <template #footnote>
          <span class="stat-footnote-label" data-testid="import-now-balance">
            {{
              $t('operations.import.account.now', {
                amount: formatMoney(toMinorUnits(current.balance), currency),
              })
            }}
          </span>
        </template>
      </StatCard>
      <StatCard
        :label="$t('dashboard.totalReconciled')"
        :amount="projected.reconciledBalance"
        :currency="currency"
        value-testid="import-after-reconciled"
        data-testid="import-after-reconciled-card"
      >
        <template #footnote>
          <span class="stat-footnote-label" data-testid="import-now-reconciled">
            {{
              $t('operations.import.account.now', {
                amount: formatMoney(toMinorUnits(current.reconciledBalance), currency),
              })
            }}
          </span>
        </template>
      </StatCard>
    </div>
  </section>
</template>

<style scoped>
.account-grid {
  max-width: 64rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
}
</style>

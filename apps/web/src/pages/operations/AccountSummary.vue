<script setup lang="ts">
import { computed } from 'vue';
import { formatMoney } from '../../domain/money';

// The account's balance, its reconciled part and what is left to reconcile,
// stacked in a panel beside the chart. The panel turns into one row when it
// has the width for it (alone on the page, or the page too narrow to put it
// beside the chart). The balance is red when overdrawn; the other two stay
// plain, since an overdraft is already said once.
const props = defineProps<{ balance: number; reconciled: number; currency: string }>();

const unreconciled = computed(() => props.balance - props.reconciled);
</script>

<template>
  <section class="account-summary panel" data-testid="account-balances">
    <div class="account-summary-body">
      <div class="summary-row">
        <div class="summary-label">{{ $t('operations.balance') }}</div>
        <div
          class="summary-value summary-value-primary"
          :class="{ 'text-danger': balance < 0 }"
          data-testid="account-balance"
        >
          {{ formatMoney(balance, currency) }}
        </div>
      </div>
      <div class="summary-row">
        <div class="summary-label">{{ $t('dashboard.totalReconciled') }}</div>
        <div class="summary-value" data-testid="account-reconciled">
          {{ formatMoney(reconciled, currency) }}
        </div>
      </div>
      <div class="summary-row">
        <div class="summary-label">{{ $t('operations.unreconciled') }}</div>
        <div class="summary-value" data-testid="account-unreconciled">
          {{ formatMoney(unreconciled, currency) }}
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* The container is the panel, so the layout below can follow its own width
   rather than the viewport's. */
.account-summary {
  container-type: inline-size;
  padding: 4px 24px;
}
.account-summary-body {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.summary-row {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 14px 0;
}
.summary-row + .summary-row {
  border-top: 1px solid var(--border);
}
.summary-label {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.summary-value {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.summary-value-primary {
  font-size: 30px;
}

@container (min-width: 520px) {
  .account-summary-body {
    flex-direction: row;
  }
  .summary-row {
    padding: 18px 0;
  }
  .summary-row + .summary-row {
    border-top: 0;
    border-left: 1px solid var(--border);
    padding-left: 24px;
    margin-left: 24px;
  }
}
</style>

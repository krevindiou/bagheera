<script setup lang="ts">
import { toMinorUnits } from '@bagheera/money';
import { computed } from 'vue';
import type { components } from '../../api/schema';
import StatCard from '../../components/StatCard.vue';
import { formatDate, formatMoney } from '../../domain/money';

type Statement = components['schemas']['StatementSummaryDto'];

// What the file says about itself, and whether it seems to belong to the
// account chosen: when it does not, importing needs the Member's say-so.
const props = defineProps<{
  statement: Statement;
  currency: string;
  // The account of the Member that the file was imported into before.
  otherAccountName: string | null;
  // Whether the Member accepts importing a file that seems to be another account's.
  accepted?: boolean;
}>();
const emit = defineEmits<{ 'update:accepted': [accepted: boolean] }>();

// Credits less debits, in minor units.
const net = computed(
  () => toMinorUnits(props.statement.creditTotal) - toMinorUnits(props.statement.debitTotal),
);

const difference = computed(() => {
  const closing = props.statement.closing;
  return closing?.expected != null
    ? toMinorUnits(closing.amount) - toMinorUnits(closing.expected)
    : 0;
});
</script>

<template>
  <section class="mb-4" data-testid="import-statement">
    <h2 class="h6">{{ $t('operations.import.statement.title') }}</h2>
    <p
      v-if="statement.periodStart && statement.periodEnd"
      class="text-muted small"
      data-testid="import-period"
    >
      {{ $t('operations.import.statement.period') }}: {{ formatDate(statement.periodStart) }} –
      {{ formatDate(statement.periodEnd) }}
    </p>

    <div
      v-if="statement.accountCheck === 'different' || statement.accountCheck === 'elsewhere'"
      class="alert alert-warning"
      role="alert"
      data-testid="import-account-warning"
    >
      <p class="mb-2">
        <template v-if="statement.accountCheck === 'different'">
          {{ $t('operations.import.statement.different') }}
        </template>
        <template v-else>
          {{
            otherAccountName
              ? $t('operations.import.statement.elsewhere', { account: otherAccountName })
              : $t('operations.import.statement.elsewhereUnnamed')
          }}
        </template>
      </p>
      <label class="d-flex align-items-center gap-2 mb-0">
        <input
          type="checkbox"
          :checked="accepted"
          data-testid="import-accept-mismatch"
          @change="emit('update:accepted', ($event.target as HTMLInputElement).checked)"
        />
        {{ $t('operations.import.statement.acceptMismatch') }}
      </label>
    </div>

    <div class="statement-grid">
      <StatCard
        :label="$t('operations.import.statement.debits')"
        :amount="toMinorUnits(statement.debitTotal)"
        :currency="currency"
        trend="down"
        value-testid="import-debits-value"
        data-testid="import-debits"
      />
      <StatCard
        :label="$t('operations.import.statement.credits')"
        :amount="toMinorUnits(statement.creditTotal)"
        :currency="currency"
        trend="up"
        value-testid="import-credits-value"
        data-testid="import-credits"
      />
      <StatCard
        :label="$t('operations.import.statement.net')"
        :amount="net"
        :currency="currency"
        :trend="net > 0 ? 'up' : net < 0 ? 'down' : undefined"
        value-testid="import-net-value"
        data-testid="import-net"
      >
        <template #footnote>
          <span class="stat-footnote-label">{{ $t('operations.import.statement.netNote') }}</span>
        </template>
      </StatCard>
      <template v-if="statement.closing">
        <StatCard
          :label="$t('operations.import.statement.closing')"
          :amount="toMinorUnits(statement.closing.amount)"
          :currency="currency"
          data-testid="import-closing"
        >
          <template #footnote>
            <span class="stat-footnote-label">
              {{
                $t('operations.import.statement.asOf', { date: formatDate(statement.closing.date) })
              }}
            </span>
          </template>
        </StatCard>
        <StatCard
          v-if="statement.closing.expected !== null"
          :label="$t('operations.import.statement.expected')"
          :amount="toMinorUnits(statement.closing.expected)"
          :currency="currency"
          data-testid="import-expected"
        >
          <template #footnote>
            <span
              v-if="difference === 0"
              class="pill text-success"
              data-testid="import-balance-matches"
            >
              {{ $t('operations.import.statement.matches') }}
            </span>
            <span v-else class="pill pill-amber" data-testid="import-balance-differs">
              {{
                $t('operations.import.statement.differs', {
                  amount: formatMoney(Math.abs(difference), currency),
                })
              }}
            </span>
          </template>
        </StatCard>
      </template>
    </div>
  </section>
</template>

<style scoped>
.statement-grid {
  max-width: 64rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
}

/* A difference sentence is longer than a footnote figure: let the pill wrap. */
.statement-grid :deep(.pill) {
  white-space: normal;
}
</style>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiClient } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { unwrap } from '../../api/unwrap';
import SynthesisChartPanel from '../../components/SynthesisChartPanel.vue';
import type { SynthesisChartSeries } from '../../components/SynthesisChart.vue';
import { colorForCurrency } from '../../components/chartColors';
import {
  DEFAULT_SYNTHESIS_CHART_RANGE,
  type SynthesisChartRange,
} from '../../components/synthesisChartRange';
import { useAccountContext } from '../../composables/useAccountContext';
import {
  useAccountsQuery,
  useBanksQuery,
  useCategoriesQuery,
  usePaymentMethodsQuery,
} from '../../composables/useReferenceQueries';
import { useOperationSearch } from '../../composables/useOperationSearch';
import { useSelection } from '../../composables/useSelection';
import { formatDate, formatMoney, toDisplayBounds, toDisplayPoints } from '../../domain/money';
import { categoryLabel, PAYMENT_METHOD_ID, thirdPartyLabel } from '../../domain/referenceData';
import type { Operation } from '../../domain/referenceData';
import OperationForm from './OperationForm.vue';
import BatchActions from './batch.vue';
import SearchPanel from './search.vue';
import IconButton from '../../components/IconButton.vue';
import PagerNav from '../../components/PagerNav.vue';
import StatCard from '../../components/StatCard.vue';
import AppIcon from '../../components/AppIcon.vue';
import PaymentMethodIcon from '../../components/PaymentMethodIcon.vue';
import StatusIcon from '../../components/StatusIcon.vue';

const route = useRoute();
const accountId = computed(() => route.params.accountId as string);

const queryClient = useQueryClient();

const showForm = ref(false);
const editingOperation = ref<Operation | null>(null);
const { selectedIds, selectedIdList, toggleSelected } = useSelection();
const {
  page,
  list,
  isError: operationsError,
  isActive: hasActiveSearch,
  panelOpen: showSearch,
  criteria: recalledCriteria,
  openPanel: openSearch,
  closePanel: closeSearch,
  run: runSearch,
  clear: clearSearch,
} = useOperationSearch(accountId);
// A new page of results (paging, a search, a refetch) starts unselected.
watch(list, () => {
  selectedIds.value = new Set();
});

const { accounts } = useAccountsQuery();
const { banks } = useBanksQuery();
const { categories } = useCategoriesQuery();
const { paymentMethods } = usePaymentMethodsQuery();
const { account, bank, isFullyActive, currency } = useAccountContext(accountId);

const balanceQuery = useQuery({
  queryKey: computed(() => queryKeys.balance(accountId.value)),
  queryFn: async () =>
    unwrap(
      await apiClient.GET('/accounts/{id}/balance', {
        params: { path: { id: accountId.value } },
      }),
    ),
});
const balance = computed(() => balanceQuery.data.value ?? null);

const chartRange = ref<SynthesisChartRange>(DEFAULT_SYNTHESIS_CHART_RANGE);

const chartQuery = useQuery({
  queryKey: computed(() => queryKeys.chart.range(accountId.value, chartRange.value)),
  queryFn: async () =>
    unwrap(
      await apiClient.GET('/accounts/{id}/chart', {
        params: { path: { id: accountId.value }, query: { range: chartRange.value } },
      }),
    ),
});
const chartSeries = computed<SynthesisChartSeries[]>(() => {
  const chart = chartQuery.data.value;
  if (!chart || chart.points.length === 0) return [];
  return [
    {
      label: chart.currency,
      color: colorForCurrency(chart.currency),
      points: toDisplayPoints(chart.points, chart.currency),
    },
  ];
});
const chartAxisBounds = computed(() => toDisplayBounds(chartQuery.data.value?.axisBounds));

const categoryNames = computed(
  () => new Map(categories.value.map((c) => [c.id, categoryLabel(c, categories.value)])),
);

// Both money-changing: every cached page of this account's operations (not
// just the one showing — the old per-page key left stale rows on any other
// page until its own next visit), this account's own chart/balance, and —
// since a single operation edit moves this account's balance — the
// dashboard's totals and the accounts list's own balances, wherever else
// they're cached.
async function refreshAfterSave() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.operations.all(accountId.value) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.chart.all(accountId.value) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.balance(accountId.value) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
  ]);
}

async function refreshAfterBatch() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.operations.all(accountId.value) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.balance(accountId.value) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
  ]);
}

function amountLabel(operation: Operation): string {
  const minorUnits = operation.debit ?? operation.credit ?? 0;
  return formatMoney(minorUnits, currency.value);
}

function startCreate() {
  editingOperation.value = null;
  showForm.value = true;
}

function startEdit(operation: Operation) {
  editingOperation.value = operation;
  showForm.value = true;
}

async function onSaved() {
  editingOperation.value = null;
  await refreshAfterSave();
}

async function onSavedAndClose() {
  showForm.value = false;
  await onSaved();
}

// The system-generated opening operation is not editable.
function isEditable(operation: Operation): boolean {
  return operation.paymentMethodId !== PAYMENT_METHOD_ID.INITIAL_BALANCE;
}
</script>

<template>
  <div>
    <router-link :to="{ name: 'accounts' }" class="back-link">
      <AppIcon name="arrowLeft" :size="12" />
      {{ $t('nav.accounts') }}
    </router-link>

    <!-- Header action row: New operation, Search toggle, Schedulers link.
         The first-operation tip anchors right above "New operation",
         which is hidden on closed accounts. -->
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
      <h1 v-if="account" class="mb-0" style="font-size: 24px">
        {{ bank?.name }} — {{ account.name }}
      </h1>
      <h1 v-else class="mb-0" style="font-size: 24px">{{ $t('operations.title') }}</h1>
      <div class="d-flex flex-wrap gap-2">
        <button
          v-if="isFullyActive"
          type="button"
          class="btn btn-primary d-inline-flex align-items-center gap-1"
          @click="startCreate"
        >
          <AppIcon name="plus" :size="16" />
          {{ $t('operations.addOperation') }}
        </button>
        <button
          type="button"
          class="btn btn-outline-secondary d-inline-flex align-items-center gap-2"
          data-testid="toggle-search"
          :title="hasActiveSearch ? $t('operations.search.activeHint') : undefined"
          @click="openSearch"
        >
          <AppIcon name="search" />
          {{ $t('operations.search.show') }}
          <span
            v-if="hasActiveSearch"
            class="dot dot-active"
            data-testid="search-active-dot"
          ></span>
        </button>
        <router-link
          :to="{ name: 'schedulers', params: { accountId } }"
          class="btn btn-outline-secondary"
        >
          {{ $t('operations.schedulersLink') }}
        </router-link>
      </div>
    </div>

    <p
      v-if="isFullyActive && list.items.length === 0 && !hasActiveSearch"
      class="text-muted mb-3"
      data-testid="onboarding-tip"
    >
      {{ $t('operations.firstOperationTip') }}
    </p>

    <div v-if="balance" class="mb-4" data-testid="account-balances">
      <StatCard
        variant="chip"
        :label="$t('operations.balance')"
        :amount="balance.balance"
        :currency="currency"
        :reconciled="balance.reconciledBalance"
        primary
      />
    </div>

    <SynthesisChartPanel
      v-if="chartSeries.length > 0"
      v-model:range="chartRange"
      :series="chartSeries"
      :axis-bounds="chartAxisBounds"
      range-testid="account-chart-range"
    />

    <div>
      <BatchActions v-if="isFullyActive" :selected-ids="selectedIdList" @done="refreshAfterBatch" />

      <div v-if="operationsError" class="alert alert-danger mb-3" data-testid="operations-error">
        {{ $t('common.loadError') }}
      </div>

      <div v-else-if="list.items.length === 0" class="mb-3">
        <p class="text-muted">{{ $t('operations.empty') }}</p>
      </div>

      <div v-else>
        <div class="table-responsive">
          <table class="table" data-testid="operations-table">
            <thead>
              <tr>
                <th v-if="isFullyActive"></th>
                <th></th>
                <th>{{ $t('operations.thirdParty') }}</th>
                <th class="text-end">{{ $t('operations.amount') }}</th>
                <th>{{ $t('operations.paymentMethod') }}</th>
                <th>{{ $t('operations.category') }}</th>
                <th>{{ $t('operations.valueDate') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="operation in list.items"
                :key="operation.id"
                data-testid="operation-row"
                :class="{ 'table-active': selectedIds.has(operation.id) }"
                :style="isEditable(operation) ? 'cursor: pointer' : undefined"
                @click="isEditable(operation) && startEdit(operation)"
              >
                <td v-if="isFullyActive" @click.stop>
                  <input
                    v-if="isEditable(operation)"
                    type="checkbox"
                    :checked="selectedIds.has(operation.id)"
                    @change="toggleSelected(operation.id)"
                  />
                </td>
                <td>
                  <StatusIcon
                    v-if="operation.reconciled"
                    kind="reconciled"
                    :label="$t('operations.reconciled')"
                  />
                  <StatusIcon
                    v-if="operation.schedulerId"
                    kind="scheduler"
                    :label="$t('operations.generatedByScheduler')"
                  />
                </td>
                <td>{{ thirdPartyLabel(operation.thirdParty, operation.paymentMethodId) }}</td>
                <td
                  class="text-end amount"
                  :class="operation.debit ? 'text-danger' : 'text-success'"
                >
                  {{ operation.debit ? '-' : '+' }}{{ amountLabel(operation) }}
                </td>
                <td>
                  <PaymentMethodIcon
                    :id="operation.paymentMethodId"
                    :payment-methods="paymentMethods"
                  />
                </td>
                <td>{{ operation.categoryId ? categoryNames.get(operation.categoryId) : '' }}</td>
                <td>{{ formatDate(operation.valueDate) }}</td>
                <td @click.stop>
                  <IconButton
                    v-if="isEditable(operation)"
                    icon="edit"
                    :label="$t('operations.edit')"
                    @click="startEdit(operation)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <PagerNav
          :page="list.page"
          :total="list.total"
          :page-size="list.pageSize"
          @update:page="page = $event"
        />
      </div>

      <OperationForm
        v-if="showForm"
        :account-id="accountId"
        :categories="categories"
        :payment-methods="paymentMethods"
        :accounts="accounts"
        :banks="banks"
        :operation="editingOperation"
        @saved="onSavedAndClose"
        @saved-and-new="onSaved"
        @cancel="showForm = false"
      />

      <SearchPanel
        v-if="showSearch"
        :categories="categories"
        :payment-methods="paymentMethods"
        :initial-criteria="recalledCriteria"
        @submit="runSearch"
        @clear="clearSearch"
        @cancel="closeSearch"
      />
    </div>
  </div>
</template>

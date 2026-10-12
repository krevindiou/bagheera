<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiClient } from '../../api/client';
import { invalidateAccountData, queryKeys } from '../../api/queryKeys';
import { unwrap } from '../../api/unwrap';
import SynthesisChartPanel from '../../components/SynthesisChartPanel.vue';
import type { SynthesisChartSeries } from '../../components/SynthesisChart.vue';
import { colorForCurrency } from '../../components/chartColors';
import {
  DEFAULT_SYNTHESIS_CHART_RANGE,
  type SynthesisChartRange,
} from '../../components/synthesisChartRange';
import { useAccountContext } from '../../composables/useAccountContext';
import { usePageTitle } from '../../composables/useDocumentTitle';
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
import ListState from '../../components/ListState.vue';
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
  isPending: operationsPending,
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

const { t } = useI18n();
usePageTitle(
  computed(() => (account.value ? `${account.value.name} · ${t('operations.title')}` : null)),
);

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

// No heading repeats the account name near the chart, so it names itself.
const chartAriaLabel = computed(() => `${t('operations.balance')}, ${account.value?.name ?? ''}`);

const categoryNames = computed(
  () => new Map(categories.value.map((c) => [c.id, categoryLabel(c, categories.value)])),
);

// Every page of this account's operations, its chart and balance, and the
// dashboard and accounts list balances — shared by both the form save and
// the batch bar, since either can change the same data.
async function refreshAccountData() {
  await invalidateAccountData(queryClient, accountId.value);
}

function amountLabel(operation: Operation): string {
  const minorUnits = operation.debit ?? operation.credit ?? 0;
  return formatMoney(minorUnits, currency.value);
}

// null both for a non-transfer and for a transfer whose counterpart account
// is gone (e.g. deleted) — either way, nothing extra is shown.
function transferCounterpartName(operation: Operation): string | null {
  if (!operation.transferAccountId) return null;
  return accounts.value.find((a) => a.id === operation.transferAccountId)?.name ?? null;
}

// The date disambiguates rows sharing the same third party.
function selectRowLabel(operation: Operation): string {
  const name = `${thirdPartyLabel(operation.thirdParty, operation.paymentMethodId)} – ${formatDate(operation.valueDate)}`;
  return t('common.selectRow', { name });
}

// Names the row's Edit button for its own operation, so a screen reader
// doesn't hear a run of identical "Edit" buttons.
function operationActionLabel(action: string, operation: Operation): string {
  return t('common.actionOn', {
    action,
    name: thirdPartyLabel(operation.thirdParty, operation.paymentMethodId),
  });
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
  await refreshAccountData();
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
          <AppIcon name="search" :size="16" />
          {{ $t('operations.search.show') }}
          <span v-if="hasActiveSearch" class="visually-hidden">
            {{ $t('operations.search.filterActiveSuffix') }}
          </span>
          <span
            v-if="hasActiveSearch"
            class="dot dot-active"
            aria-hidden="true"
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
      v-if="
        isFullyActive &&
        !operationsPending &&
        list.items.length === 0 &&
        !hasActiveSearch &&
        !operationsError
      "
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
      :label="chartAriaLabel"
      range-testid="account-chart-range"
    />

    <div>
      <BatchActions
        v-if="isFullyActive"
        :selected-ids="selectedIdList"
        @done="refreshAccountData"
      />

      <div
        v-if="hasActiveSearch"
        class="alert alert-secondary d-flex justify-content-between align-items-center py-2 mb-3"
        data-testid="search-active-banner"
      >
        <span>{{ $t('operations.search.filteredNotice') }}</span>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          data-testid="search-active-clear"
          @click="clearSearch"
        >
          {{ $t('operations.search.clear') }}
        </button>
      </div>

      <ListState
        :error="operationsError"
        :loading="operationsPending"
        :empty="list.items.length === 0"
        :empty-text="$t('operations.empty')"
        error-testid="operations-error"
      >
        <div class="table-responsive">
          <table class="table" data-testid="operations-table">
            <thead>
              <tr>
                <th v-if="isFullyActive"></th>
                <th></th>
                <th>{{ $t('operations.thirdParty') }}</th>
                <th class="text-end">{{ $t('operations.amount') }}</th>
                <th class="d-none d-md-table-cell">{{ $t('operations.paymentMethod') }}</th>
                <th class="d-none d-md-table-cell">{{ $t('operations.category') }}</th>
                <th class="text-nowrap">{{ $t('operations.valueDate') }}</th>
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
                    :aria-label="selectRowLabel(operation)"
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
                <td>
                  {{ thirdPartyLabel(operation.thirdParty, operation.paymentMethodId) }}
                  <div
                    v-if="transferCounterpartName(operation)"
                    class="text-muted small"
                    data-testid="transfer-counterpart"
                  >
                    {{
                      operation.debit
                        ? $t('operations.transferTo', { name: transferCounterpartName(operation) })
                        : $t('operations.transferFrom', {
                            name: transferCounterpartName(operation),
                          })
                    }}
                  </div>
                </td>
                <td
                  class="text-end amount text-nowrap"
                  :class="operation.debit ? 'text-danger' : 'text-success'"
                >
                  {{ operation.debit ? '-' : '+' }}{{ amountLabel(operation) }}
                </td>
                <td class="d-none d-md-table-cell">
                  <PaymentMethodIcon
                    :id="operation.paymentMethodId"
                    :payment-methods="paymentMethods"
                  />
                </td>
                <td class="d-none d-md-table-cell">
                  {{ operation.categoryId ? categoryNames.get(operation.categoryId) : '' }}
                </td>
                <td class="text-nowrap">{{ formatDate(operation.valueDate) }}</td>
                <td @click.stop>
                  <IconButton
                    v-if="isEditable(operation)"
                    icon="edit"
                    :label="$t('operations.edit')"
                    :aria-label="operationActionLabel($t('operations.edit'), operation)"
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
      </ListState>

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

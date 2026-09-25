<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { apiClient } from '../../api/client';
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
import { useSelection } from '../../composables/useSelection';
import { formatDate, formatMoney, toDisplayBounds, toDisplayPoints } from './money';
import {
  categoryLabel,
  PAYMENT_METHOD_ID,
  paymentMethodIcon,
  paymentMethodName,
  thirdPartyLabel,
} from './operations.types';
import type { Operation, SearchCriteria } from './operations.types';
import OperationForm from './OperationForm.vue';
import BatchActions from './batch.vue';
import SearchPanel from './search.vue';
import IconButton from '../../components/IconButton.vue';
import PagerNav from '../../components/PagerNav.vue';
import StatCard from '../../components/StatCard.vue';
import AppIcon from '../../components/AppIcon.vue';

const route = useRoute();
const accountId = computed(() => route.params.accountId as string);

const queryClient = useQueryClient();

const page = ref(1);
watch(accountId, () => {
  page.value = 1;
});

const showForm = ref(false);
const editingOperation = ref<Operation | null>(null);
const { selectedIds, selectedIdList, toggleSelected } = useSelection();
const showSearch = ref(false);
const hasActiveSearch = ref(false);
const recalledCriteria = ref<SearchCriteria | undefined>(undefined);
// Set right before a search/clear mutation writes its own result into the
// `operations` query cache, so the watch below (which reruns off that same
// write) doesn't mistake it for a page-load recall and pop the panel back
// open right after the mutation closed it.
const suppressRecallOpen = ref(false);

const { accounts } = useAccountsQuery();
const { banks } = useBanksQuery();
const { categories } = useCategoriesQuery();
const { paymentMethods } = usePaymentMethodsQuery();
const { account, bank, isFullyActive, currency } = useAccountContext(accountId);

const balanceQuery = useQuery({
  queryKey: computed(() => ['balance', accountId.value]),
  queryFn: async () => {
    const { data } = await apiClient.GET('/accounts/{id}/balance', {
      params: { path: { id: accountId.value } },
    });
    return data ?? null;
  },
});
const balance = computed(() => balanceQuery.data.value ?? null);

const chartRange = ref<SynthesisChartRange>(DEFAULT_SYNTHESIS_CHART_RANGE);

const chartQuery = useQuery({
  queryKey: computed(() => ['chart', accountId.value, chartRange.value]),
  queryFn: async () => {
    const { data } = await apiClient.GET('/accounts/{id}/chart', {
      params: { path: { id: accountId.value }, query: { range: chartRange.value } },
    });
    return data ?? null;
  },
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

// Re-runs the search remembered for this member+account (empty criteria —
// i.e. the full list — when nothing was ever searched), so a search stays
// applied across pagination and page reloads within the session. When the
// recalled search is active, the panel is restored docked open and
// hydrated with its criteria.
const operationsQuery = useQuery({
  queryKey: computed(() => ['operations', accountId.value, page.value]),
  queryFn: async () => {
    const { data } = await apiClient.GET('/operations/search', {
      params: { query: { accountId: accountId.value, page: String(page.value) } },
    });
    return data ?? { items: [], total: 0, page: 1, pageSize: 20, criteria: {}, active: false };
  },
});
const list = computed(
  () => operationsQuery.data.value ?? { items: [], total: 0, page: 1, pageSize: 20 },
);

watch(
  () => operationsQuery.data.value,
  (result) => {
    selectedIds.value = new Set();
    hasActiveSearch.value = result?.active ?? false;
    if (result?.active && !suppressRecallOpen.value) {
      recalledCriteria.value = result.criteria;
      showSearch.value = true;
    }
    suppressRecallOpen.value = false;
  },
);

const categoryNames = computed(
  () => new Map(categories.value.map((c) => [c.id, categoryLabel(c, categories.value)])),
);

const searchMutation = useMutation({
  mutationFn: async (criteria: SearchCriteria) => {
    const { data } = await apiClient.POST('/operations/search', {
      params: { query: { page: '1' } },
      body: { accountId: accountId.value, ...criteria },
    });
    return data ?? { items: [], total: 0, page: 1, pageSize: 20 };
  },
  onSuccess(data, criteria) {
    page.value = 1;
    suppressRecallOpen.value = true;
    // The watch's own hydration is skipped by the suppress guard above, so
    // hydrate the panel's fields here from what was actually submitted —
    // otherwise reopening "Search operation" later shows a blank form.
    recalledCriteria.value = criteria;
    // Mark the cached page as an active search, or the `operationsQuery.data`
    // watch below (which reruns off this same write) sees no `active` flag
    // and immediately flips hasActiveSearch back off.
    queryClient.setQueryData(['operations', accountId.value, 1], {
      ...data,
      active: true,
      criteria,
    });
    selectedIds.value = new Set();
    hasActiveSearch.value = true;
    showSearch.value = false;
  },
});
function runSearch(criteria: SearchCriteria) {
  searchMutation.mutate(criteria);
}

const clearSearchMutation = useMutation({
  mutationFn: async () => {
    await apiClient.DELETE('/operations/search', {
      params: { query: { accountId: accountId.value } },
    });
  },
  async onSuccess() {
    hasActiveSearch.value = false;
    page.value = 1;
    showSearch.value = false;
    await queryClient.invalidateQueries({ queryKey: ['operations', accountId.value] });
  },
});
function clearSearch() {
  clearSearchMutation.mutate();
}

async function refreshAfterSave() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['operations', accountId.value, page.value] }),
    queryClient.invalidateQueries({ queryKey: ['chart', accountId.value] }),
    queryClient.invalidateQueries({ queryKey: ['balance', accountId.value] }),
  ]);
}

async function refreshAfterBatch() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['operations', accountId.value, page.value] }),
    queryClient.invalidateQueries({ queryKey: ['balance', accountId.value] }),
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
      ← {{ $t('nav.accounts') }}
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
          @click="showSearch = true"
        >
          <AppIcon name="search" class="icon-16" />
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

      <div v-if="list.items.length === 0" class="mb-3">
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
                  <span
                    v-if="operation.reconciled"
                    class="reconciled-dot"
                    :title="$t('operations.reconciled')"
                    data-testid="reconciled-icon"
                    >✓</span
                  >
                  <span
                    v-if="operation.schedulerId"
                    :title="$t('operations.generatedByScheduler')"
                    data-testid="scheduler-icon"
                    >🕐</span
                  >
                </td>
                <td>{{ thirdPartyLabel(operation.thirdParty, operation.paymentMethodId) }}</td>
                <td
                  class="text-end amount"
                  :class="operation.debit ? 'text-danger' : 'text-success'"
                >
                  {{ operation.debit ? '-' : '+' }}{{ amountLabel(operation) }}
                </td>
                <td :title="paymentMethodName(operation.paymentMethodId, paymentMethods)">
                  {{ paymentMethodIcon(operation.paymentMethodId) }}
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
        @cancel="showSearch = false"
      />
    </div>
  </div>
</template>

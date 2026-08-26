<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { apiClient } from "../../api/client";
import SynthesisChart, { type SynthesisChartSeries } from "../../components/SynthesisChart.vue";
import type { Account, Bank } from "../accounts/accounts.types";
import { formatDate, formatMoney } from "./money";
import { categoryLabel, PAYMENT_METHOD_ICONS, PAYMENT_METHOD_NAMES } from "./operations.types";
import type { Category, Operation, OperationList, SearchCriteria } from "./operations.types";
import OperationForm from "./OperationForm.vue";
import BatchActions from "./batch.vue";
import SearchPanel from "./search.vue";

const route = useRoute();
const accountId = computed(() => Number(route.params.accountId));

const account = ref<Account | null>(null);
const accounts = ref<Account[]>([]);
const banks = ref<Bank[]>([]);
const categories = ref<Category[]>([]);
const list = ref<OperationList>({ items: [], total: 0, page: 1, pageSize: 20 });
const chartSeries = ref<SynthesisChartSeries[]>([]);
const chartAxisBounds = ref<{ min: number; max: number } | null>(null);
const balance = ref<{ balance: number; reconciledBalance: number } | null>(null);
const showForm = ref(false);
const editingOperation = ref<Operation | null>(null);
const selectedIds = ref<Set<number>>(new Set());
const showSearch = ref(false);
const hasActiveSearch = ref(false);

const pageCount = computed(() => Math.max(1, Math.ceil(list.value.total / list.value.pageSize)));
const categoryNames = computed(
  () => new Map(categories.value.map((c) => [c.id, categoryLabel(c, categories.value)])),
);
const selectedIdList = computed(() => Array.from(selectedIds.value));

// "Fully active" per spec: neither the account nor its bank is closed or
// deleted. Deleted accounts are unreachable (routing/loadAccounts already
// exclude them), so only the closed flags matter here.
const accountBank = computed(() => banks.value.find((b) => b.id === account.value?.bankId) ?? null);
const isAccountFullyActive = computed(
  () => !!account.value && !account.value.closed && !!accountBank.value && !accountBank.value.closed,
);

async function loadAccounts() {
  const [accountsResult, banksResult] = await Promise.all([
    apiClient.GET("/accounts"),
    apiClient.GET("/banks"),
  ]);
  accounts.value = (accountsResult.data as Account[] | undefined) ?? [];
  banks.value = (banksResult.data as Bank[] | undefined) ?? [];
  account.value = accounts.value.find((a) => a.id === accountId.value) ?? null;
}

async function loadBalance() {
  const { data } = await apiClient.GET("/accounts/{id}/balance", {
    params: { path: { id: accountId.value } },
  });
  balance.value = (data as { balance: number; reconciledBalance: number } | undefined) ?? null;
}

async function loadCategories() {
  const { data } = await apiClient.GET("/reference-data/categories");
  categories.value = (data as Category[] | undefined) ?? [];
}

// Re-runs the search remembered for this member+account (empty criteria —
// i.e. the full list — when nothing was ever searched), so a search stays
// applied across pagination and page reloads within the session.
async function loadOperations(page = 1) {
  const { data } = await apiClient.GET("/operations/search", {
    params: { query: { accountId: accountId.value, page: String(page) } },
  });
  list.value = (data as OperationList | undefined) ?? {
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  };
  selectedIds.value = new Set();
}

async function runSearch(criteria: SearchCriteria) {
  const { data } = await apiClient.POST("/operations/search", {
    params: { query: { page: "1" } },
    body: { accountId: accountId.value, ...criteria },
  });
  list.value = (data as OperationList | undefined) ?? {
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  };
  selectedIds.value = new Set();
  hasActiveSearch.value = true;
}

async function clearSearch() {
  await apiClient.DELETE("/operations/search", {
    params: { query: { accountId: accountId.value } },
  });
  hasActiveSearch.value = false;
  await loadOperations(1);
}

async function loadChart() {
  const { data } = await apiClient.GET("/accounts/{id}/chart", {
    params: { path: { id: accountId.value } },
  });
  const chart = data as
    | {
        currency: string;
        axisBounds: { min: number; max: number } | null;
        points: { period: string; value: number }[];
      }
    | undefined;
  if (!chart || chart.points.length === 0) {
    chartSeries.value = [];
    chartAxisBounds.value = null;
    return;
  }
  chartSeries.value = [{ label: chart.currency, color: "#0d6efd", points: chart.points }];
  chartAxisBounds.value = chart.axisBounds;
}

async function loadAll() {
  await Promise.all([
    loadAccounts(),
    loadCategories(),
    loadOperations(1),
    loadChart(),
    loadBalance(),
  ]);
}

onMounted(loadAll);
watch(accountId, loadAll);

function paymentMethodName(id: number): string {
  return PAYMENT_METHOD_NAMES[id] ?? String(id);
}

function paymentMethodIcon(id: number): string {
  return PAYMENT_METHOD_ICONS[id] ?? "";
}

function amountLabel(operation: Operation): string {
  const minorUnits = operation.debit ?? operation.credit ?? 0;
  return formatMoney(minorUnits, account.value?.currency ?? "USD");
}

function toggleSelected(id: number) {
  const next = new Set(selectedIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedIds.value = next;
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
  await Promise.all([loadOperations(list.value.page), loadChart(), loadBalance()]);
}

async function onSavedAndClose() {
  showForm.value = false;
  await onSaved();
}

function goToPage(page: number) {
  if (page < 1 || page > pageCount.value) return;
  loadOperations(page);
}

// The system-generated opening operation (payment method id 9) is not
// editable.
function isEditable(operation: Operation): boolean {
  return operation.paymentMethodId !== 9;
}
</script>

<template>
  <div class="container py-5">
    <h1 v-if="account">
      {{ accountBank?.name }} − {{ account.name }}
    </h1>
    <h1 v-else>{{ $t("operations.title") }}</h1>

    <div v-if="balance" class="d-flex gap-4 mb-3" data-testid="account-balances">
      <span
        >{{ $t("operations.balance") }}:
        <strong :class="balance.balance >= 0 ? 'text-success' : 'text-danger'">{{
          formatMoney(balance.balance, account?.currency ?? "USD", true)
        }}</strong></span
      >
      <span
        >{{ $t("operations.reconciledBalance") }}:
        <strong :class="balance.reconciledBalance >= 0 ? 'text-success' : 'text-danger'">{{
          formatMoney(balance.reconciledBalance, account?.currency ?? "USD", true)
        }}</strong></span
      >
    </div>

    <!-- Header action row: New operation, Search toggle, Schedulers link.
         The first-operation tip anchors right above "New operation",
         which is hidden on closed accounts. -->
    <div class="mb-3">
      <p
        v-if="isAccountFullyActive && list.items.length === 0 && !hasActiveSearch"
        class="text-muted mb-1"
        data-testid="onboarding-tip"
      >
        {{ $t("operations.firstOperationTip") }}
      </p>
      <div class="d-flex flex-wrap gap-2">
        <button
          v-if="isAccountFullyActive"
          type="button"
          class="btn btn-primary"
          @click="startCreate"
        >
          {{ $t("operations.addOperation") }}
        </button>
        <button
          type="button"
          class="btn btn-outline-secondary"
          data-testid="toggle-search"
          @click="showSearch = !showSearch"
        >
          {{ showSearch ? $t("operations.search.hide") : $t("operations.search.show") }}
        </button>
        <router-link
          :to="{ name: 'schedulers', params: { accountId } }"
          class="btn btn-outline-secondary"
        >
          {{ $t("operations.schedulersLink") }}
        </router-link>
      </div>
    </div>

    <SynthesisChart :series="chartSeries" :axis-bounds="chartAxisBounds" />

    <div class="d-flex gap-3 align-items-start">
      <div class="flex-grow-1 min-w-0">
        <BatchActions
          v-if="isAccountFullyActive"
          :selected-ids="selectedIdList"
          @done="Promise.all([loadOperations(list.page), loadBalance()])"
        />

        <div v-if="list.items.length === 0" class="mb-3">
          <p class="text-muted">{{ $t("operations.empty") }}</p>
        </div>

        <div v-else class="table-responsive">
          <table class="table" data-testid="operations-table">
            <thead>
              <tr>
                <th v-if="isAccountFullyActive"></th>
                <th></th>
                <th>{{ $t("operations.thirdParty") }}</th>
                <th class="text-end">{{ $t("operations.amount") }}</th>
                <th>{{ $t("operations.paymentMethod") }}</th>
                <th>{{ $t("operations.category") }}</th>
                <th>{{ $t("operations.valueDate") }}</th>
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
                <td v-if="isAccountFullyActive" @click.stop>
                  <input
                    type="checkbox"
                    :checked="selectedIds.has(operation.id)"
                    @change="toggleSelected(operation.id)"
                  />
                </td>
                <td>
                  <span
                    v-if="operation.reconciled"
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
                <td>{{ operation.thirdParty }}</td>
                <td class="text-end" :class="operation.debit ? 'text-danger' : 'text-success'">
                  {{ operation.debit ? "-" : "+" }}{{ amountLabel(operation) }}
                </td>
                <td :title="paymentMethodName(operation.paymentMethodId)">
                  {{ paymentMethodIcon(operation.paymentMethodId) }}
                </td>
                <td>{{ operation.categoryId ? categoryNames.get(operation.categoryId) : "" }}</td>
                <td>{{ formatDate(operation.valueDate) }}</td>
                <td @click.stop>
                  <button
                    v-if="isEditable(operation)"
                    type="button"
                    class="btn btn-sm btn-outline-secondary"
                    @click="startEdit(operation)"
                  >
                    {{ $t("operations.edit") }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <nav class="d-flex align-items-center gap-2" aria-label="pagination">
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              :disabled="list.page <= 1"
              @click="goToPage(list.page - 1)"
            >
              {{ $t("operations.previous") }}
            </button>
            <span>{{ $t("operations.pageStatus", { page: list.page, pageCount }) }}</span>
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              :disabled="list.page >= pageCount"
              @click="goToPage(list.page + 1)"
            >
              {{ $t("operations.next") }}
            </button>
          </nav>
        </div>

        <OperationForm
          v-if="showForm"
          :account-id="accountId"
          :categories="categories"
          :accounts="accounts"
          :banks="banks"
          :operation="editingOperation"
          @saved="onSavedAndClose"
          @saved-and-new="onSaved"
          @cancel="showForm = false"
        />
      </div>

      <!-- While a search is active, the panel docks open beside the
           (narrowed) list rather than stacking above it. -->
      <SearchPanel
        v-if="showSearch"
        class="flex-shrink-0"
        style="width: 320px"
        :categories="categories"
        @submit="runSearch"
        @clear="clearSearch"
      />
    </div>
  </div>
</template>

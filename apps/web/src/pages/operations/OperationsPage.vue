<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { apiClient } from "../../api/client";
import SynthesisChart, { type SynthesisChartSeries } from "../../components/SynthesisChart.vue";
import type { Account } from "../accounts/accounts.types";
import { toDisplayAmount } from "./money";
import { PAYMENT_METHOD_NAMES } from "./operations.types";
import type { Category, Operation, OperationList, SearchCriteria } from "./operations.types";
import OperationForm from "./OperationForm.vue";
import BatchActions from "./batch.vue";
import SearchPanel from "./search.vue";

const route = useRoute();
const accountId = computed(() => Number(route.params.accountId));

const account = ref<Account | null>(null);
const accounts = ref<Account[]>([]);
const categories = ref<Category[]>([]);
const list = ref<OperationList>({ items: [], total: 0, page: 1, pageSize: 20 });
const chartSeries = ref<SynthesisChartSeries[]>([]);
const chartAxisBounds = ref<{ min: number; max: number } | null>(null);
const showForm = ref(false);
const editingOperation = ref<Operation | null>(null);
const selectedIds = ref<Set<number>>(new Set());
const showSearch = ref(false);

const pageCount = computed(() => Math.max(1, Math.ceil(list.value.total / list.value.pageSize)));
const categoryNames = computed(() => new Map(categories.value.map((c) => [c.id, c.name])));
const selectedIdList = computed(() => Array.from(selectedIds.value));

async function loadAccounts() {
  const { data } = await apiClient.GET("/accounts");
  accounts.value = (data as Account[] | undefined) ?? [];
  account.value = accounts.value.find((a) => a.id === accountId.value) ?? null;
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
  list.value = (data as OperationList | undefined) ?? { items: [], total: 0, page: 1, pageSize: 20 };
  selectedIds.value = new Set();
}

async function runSearch(criteria: SearchCriteria) {
  const { data } = await apiClient.POST("/operations/search", {
    params: { query: { page: "1" } },
    body: { accountId: accountId.value, ...criteria },
  });
  list.value = (data as OperationList | undefined) ?? { items: [], total: 0, page: 1, pageSize: 20 };
  selectedIds.value = new Set();
}

async function clearSearch() {
  await apiClient.DELETE("/operations/search", { params: { query: { accountId: accountId.value } } });
  await loadOperations(1);
}

async function loadChart() {
  const { data } = await apiClient.GET("/accounts/{id}/chart", {
    params: { path: { id: accountId.value } },
  });
  const chart = data as { currency: string; axisBounds: { min: number; max: number } | null; points: { period: string; value: number }[] } | undefined;
  if (!chart || chart.points.length === 0) {
    chartSeries.value = [];
    chartAxisBounds.value = null;
    return;
  }
  chartSeries.value = [{ label: chart.currency, color: "#0d6efd", points: chart.points }];
  chartAxisBounds.value = chart.axisBounds;
}

async function loadAll() {
  await Promise.all([loadAccounts(), loadCategories(), loadOperations(1), loadChart()]);
}

onMounted(loadAll);
watch(accountId, loadAll);

function paymentMethodName(id: number): string {
  return PAYMENT_METHOD_NAMES[id] ?? String(id);
}

function amountLabel(operation: Operation): string {
  const minorUnits = operation.debit ?? operation.credit ?? 0;
  return toDisplayAmount(minorUnits).toFixed(2);
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
  showForm.value = false;
  editingOperation.value = null;
  await Promise.all([loadOperations(list.value.page), loadChart()]);
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
    <h1>{{ $t("operations.title") }}<span v-if="account"> — {{ account.name }}</span></h1>

    <SynthesisChart :series="chartSeries" :axis-bounds="chartAxisBounds" />

    <button
      type="button"
      class="btn btn-sm btn-outline-secondary mb-3"
      data-testid="toggle-search"
      @click="showSearch = !showSearch"
    >
      {{ showSearch ? $t("operations.search.hide") : $t("operations.search.show") }}
    </button>
    <SearchPanel
      v-if="showSearch"
      :categories="categories"
      @submit="runSearch"
      @clear="clearSearch"
    />

    <BatchActions :selected-ids="selectedIdList" @done="loadOperations(list.page)" />

    <p v-if="list.items.length === 0" class="text-muted">{{ $t("operations.empty") }}</p>

    <div v-else class="table-responsive">
      <table class="table" data-testid="operations-table">
        <thead>
          <tr>
            <th></th>
            <th>{{ $t("operations.valueDate") }}</th>
            <th>{{ $t("operations.thirdParty") }}</th>
            <th>{{ $t("operations.category") }}</th>
            <th>{{ $t("operations.paymentMethod") }}</th>
            <th class="text-end">{{ $t("operations.amount") }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="operation in list.items"
            :key="operation.id"
            data-testid="operation-row"
            :class="{ 'table-active': selectedIds.has(operation.id) }"
          >
            <td>
              <input
                type="checkbox"
                :checked="selectedIds.has(operation.id)"
                @change="toggleSelected(operation.id)"
              />
            </td>
            <td>{{ operation.valueDate }}</td>
            <td>{{ operation.thirdParty }}</td>
            <td>{{ operation.categoryId ? categoryNames.get(operation.categoryId) : "" }}</td>
            <td>{{ paymentMethodName(operation.paymentMethodId) }}</td>
            <td class="text-end" :class="operation.debit ? 'text-danger' : 'text-success'">
              {{ operation.debit ? "-" : "+" }}{{ amountLabel(operation) }}
            </td>
            <td>
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
      :operation="editingOperation"
      @saved="onSaved"
      @cancel="showForm = false"
    />
    <button v-else type="button" class="btn btn-primary mt-3" @click="startCreate">
      {{ $t("operations.addOperation") }}
    </button>
  </div>
</template>

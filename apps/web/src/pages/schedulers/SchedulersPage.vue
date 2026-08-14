<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { apiClient } from "../../api/client";
import type { Account } from "../accounts/accounts.types";
import { toDisplayAmount } from "../operations/money";
import { PAYMENT_METHOD_NAMES } from "../operations/operations.types";
import type { Category } from "../operations/operations.types";
import SchedulerForm from "./SchedulerForm.vue";
import BatchActions from "./batch.vue";
import type { Scheduler, SchedulerList } from "./schedulers.types";

const route = useRoute();
const accountId = computed(() => Number(route.params.accountId));

const account = ref<Account | null>(null);
const accounts = ref<Account[]>([]);
const categories = ref<Category[]>([]);
const list = ref<SchedulerList>({ items: [], total: 0, page: 1, pageSize: 20 });
const showForm = ref(false);
const editingScheduler = ref<Scheduler | null>(null);
const selectedIds = ref<Set<number>>(new Set());

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

async function loadSchedulers(page = 1) {
  const { data } = await apiClient.GET("/schedulers", {
    params: { query: { accountId: accountId.value, page: String(page) } },
  });
  list.value = (data as SchedulerList | undefined) ?? { items: [], total: 0, page: 1, pageSize: 20 };
  selectedIds.value = new Set();
}

async function loadAll() {
  await Promise.all([loadAccounts(), loadCategories(), loadSchedulers(1)]);
}

onMounted(loadAll);
watch(accountId, loadAll);

function paymentMethodName(id: number): string {
  return PAYMENT_METHOD_NAMES[id] ?? String(id);
}

function amountLabel(scheduler: Scheduler): string {
  const minorUnits = scheduler.debit ?? scheduler.credit ?? 0;
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
  editingScheduler.value = null;
  showForm.value = true;
}

function startEdit(scheduler: Scheduler) {
  editingScheduler.value = scheduler;
  showForm.value = true;
}

async function onSaved() {
  showForm.value = false;
  editingScheduler.value = null;
  await loadSchedulers(list.value.page);
}

function goToPage(page: number) {
  if (page < 1 || page > pageCount.value) return;
  loadSchedulers(page);
}
</script>

<template>
  <div class="container py-5">
    <h1>{{ $t("schedulers.title") }}<span v-if="account"> — {{ account.name }}</span></h1>

    <BatchActions :selected-ids="selectedIdList" @done="loadSchedulers(list.page)" />

    <p v-if="list.items.length === 0" class="text-muted">{{ $t("schedulers.empty") }}</p>

    <div v-else class="table-responsive">
      <table class="table" data-testid="schedulers-table">
        <thead>
          <tr>
            <th></th>
            <th>{{ $t("schedulers.firstOccurrence") }}</th>
            <th>{{ $t("operations.thirdParty") }}</th>
            <th>{{ $t("operations.category") }}</th>
            <th>{{ $t("operations.paymentMethod") }}</th>
            <th>{{ $t("schedulers.frequencyUnit") }}</th>
            <th class="text-end">{{ $t("operations.amount") }}</th>
            <th>{{ $t("schedulers.active") }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="scheduler in list.items"
            :key="scheduler.id"
            data-testid="scheduler-row"
            :class="{ 'table-active': selectedIds.has(scheduler.id) }"
          >
            <td>
              <input
                type="checkbox"
                :checked="selectedIds.has(scheduler.id)"
                @change="toggleSelected(scheduler.id)"
              />
            </td>
            <td>{{ scheduler.valueDate }}</td>
            <td>{{ scheduler.thirdParty }}</td>
            <td>{{ scheduler.categoryId ? categoryNames.get(scheduler.categoryId) : "" }}</td>
            <td>{{ paymentMethodName(scheduler.paymentMethodId) }}</td>
            <td>{{ $t("schedulers.everyN", { count: scheduler.frequencyValue, unit: $t(`schedulers.units.${scheduler.frequencyUnit}`) }) }}</td>
            <td class="text-end" :class="scheduler.debit ? 'text-danger' : 'text-success'">
              {{ scheduler.debit ? "-" : "+" }}{{ amountLabel(scheduler) }}
            </td>
            <td>
              <span v-if="scheduler.active" class="badge text-bg-success">{{ $t("schedulers.active") }}</span>
              <span v-else class="badge text-bg-secondary">{{ $t("schedulers.paused") }}</span>
            </td>
            <td>
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary"
                @click="startEdit(scheduler)"
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

    <SchedulerForm
      v-if="showForm"
      :account-id="accountId"
      :categories="categories"
      :accounts="accounts"
      :scheduler="editingScheduler"
      @saved="onSaved"
      @cancel="showForm = false"
    />
    <button v-else type="button" class="btn btn-primary mt-3" @click="startCreate">
      {{ $t("schedulers.addScheduler") }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { apiClient } from "../../api/client";
import type { Account, Bank } from "../accounts/accounts.types";
import { formatMoney } from "../operations/money";
import {
  categoryLabel,
  paymentMethodIcon,
  paymentMethodName,
} from "../operations/operations.types";
import type { Category, PaymentMethod } from "../operations/operations.types";
import SchedulerForm from "./SchedulerForm.vue";
import BatchActions from "./batch.vue";
import type { Scheduler, SchedulerList } from "./schedulers.types";
import ToastContainer from "../../components/ToastContainer.vue";

const route = useRoute();
const accountId = computed(() => Number(route.params.accountId));

const queryClient = useQueryClient();

const page = ref(1);
watch(accountId, () => {
  page.value = 1;
});

const showForm = ref(false);
const editingScheduler = ref<Scheduler | null>(null);
const selectedIds = ref<Set<number>>(new Set());

const accountsQuery = useQuery({
  queryKey: ["accounts"],
  queryFn: async () => {
    const { data } = await apiClient.GET("/accounts");
    return (data as Account[] | undefined) ?? [];
  },
});
const accounts = computed(() => accountsQuery.data.value ?? []);
const account = computed(() => accounts.value.find((a) => a.id === accountId.value) ?? null);

const banksQuery = useQuery({
  queryKey: ["banks"],
  queryFn: async () => {
    const { data } = await apiClient.GET("/banks");
    return (data as Bank[] | undefined) ?? [];
  },
});
const banks = computed(() => banksQuery.data.value ?? []);

// "Fully active": neither the account nor its bank is closed or
// deleted (mirrors apps/web/src/pages/operations/OperationsPage.vue).
const accountBank = computed(() => banks.value.find((b) => b.id === account.value?.bankId) ?? null);
const isAccountFullyActive = computed(
  () =>
    !!account.value && !account.value.closed && !!accountBank.value && !accountBank.value.closed,
);

const categoriesQuery = useQuery({
  queryKey: ["categories"],
  queryFn: async () => {
    const { data } = await apiClient.GET("/reference-data/categories");
    return (data as Category[] | undefined) ?? [];
  },
});
const categories = computed(() => categoriesQuery.data.value ?? []);

const paymentMethodsQuery = useQuery({
  queryKey: ["payment-methods"],
  queryFn: async () => {
    const { data } = await apiClient.GET("/reference-data/payment-methods");
    return (data as PaymentMethod[] | undefined) ?? [];
  },
});
const paymentMethods = computed(() => paymentMethodsQuery.data.value ?? []);

const schedulersQuery = useQuery({
  queryKey: computed(() => ["schedulers", accountId.value, page.value]),
  queryFn: async () => {
    const { data } = await apiClient.GET("/schedulers", {
      params: { query: { accountId: accountId.value, page: String(page.value) } },
    });
    return (data as SchedulerList | undefined) ?? { items: [], total: 0, page: 1, pageSize: 20 };
  },
});
const list = computed(
  () => schedulersQuery.data.value ?? { items: [], total: 0, page: 1, pageSize: 20 },
);
watch(
  () => schedulersQuery.data.value,
  () => {
    selectedIds.value = new Set();
  },
);

const pageCount = computed(() => Math.max(1, Math.ceil(list.value.total / list.value.pageSize)));
const categoryNames = computed(
  () => new Map(categories.value.map((c) => [c.id, categoryLabel(c, categories.value)])),
);
const selectedIdList = computed(() => Array.from(selectedIds.value));

async function reloadSchedulers() {
  await queryClient.invalidateQueries({ queryKey: ["schedulers", accountId.value, page.value] });
}

function amountLabel(scheduler: Scheduler): string {
  const minorUnits = scheduler.debit ?? scheduler.credit ?? 0;
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
  await reloadSchedulers();
}

function goToPage(newPage: number) {
  if (newPage < 1 || newPage > pageCount.value) return;
  page.value = newPage;
}
</script>

<template>
  <div class="container py-5">
    <h1>
      {{ $t("schedulers.title") }}<span v-if="account"> — {{ account.name }}</span>
    </h1>
    <ToastContainer />

    <BatchActions :selected-ids="selectedIdList" @done="reloadSchedulers" />

    <p v-if="list.items.length === 0" class="text-muted">{{ $t("schedulers.empty") }}</p>

    <div v-else class="table-responsive">
      <table class="table" data-testid="schedulers-table">
        <thead>
          <tr>
            <th></th>
            <th></th>
            <th>{{ $t("operations.thirdParty") }}</th>
            <th class="text-end">{{ $t("operations.amount") }}</th>
            <th>{{ $t("operations.paymentMethod") }}</th>
            <th>{{ $t("operations.category") }}</th>
            <th class="text-end">{{ $t("schedulers.every") }}</th>
            <th>{{ $t("schedulers.frequencyUnit") }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="scheduler in list.items"
            :key="scheduler.id"
            data-testid="scheduler-row"
            :class="{ 'table-active': selectedIds.has(scheduler.id) }"
            style="cursor: pointer"
            @click="startEdit(scheduler)"
          >
            <td @click.stop>
              <input
                type="checkbox"
                :checked="selectedIds.has(scheduler.id)"
                @change="toggleSelected(scheduler.id)"
              />
            </td>
            <td>
              <span :title="scheduler.active ? $t('schedulers.active') : $t('schedulers.paused')">{{
                scheduler.active ? "▶" : "⏸"
              }}</span>
            </td>
            <td>{{ scheduler.thirdParty }}</td>
            <td class="text-end" :class="scheduler.debit ? 'text-danger' : 'text-success'">
              {{ scheduler.debit ? "-" : "+" }}{{ amountLabel(scheduler) }}
            </td>
            <td :title="paymentMethodName(scheduler.paymentMethodId, paymentMethods)">
              {{ paymentMethodIcon(scheduler.paymentMethodId) }}
            </td>
            <td>{{ scheduler.categoryId ? categoryNames.get(scheduler.categoryId) : "" }}</td>
            <td class="text-end">{{ scheduler.frequencyValue }}</td>
            <td>{{ $t(`schedulers.units.${scheduler.frequencyUnit}`) }}</td>
            <td @click.stop>
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
      :payment-methods="paymentMethods"
      :accounts="accounts"
      :banks="banks"
      :scheduler="editingScheduler"
      @saved="onSaved"
      @cancel="showForm = false"
    />
    <button
      v-else-if="isAccountFullyActive"
      type="button"
      class="btn btn-primary mt-3"
      @click="startCreate"
    >
      {{ $t("schedulers.addScheduler") }}
    </button>
  </div>
</template>

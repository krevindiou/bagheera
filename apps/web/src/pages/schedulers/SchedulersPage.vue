<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiClient } from '../../api/client';
import { useSelection } from '../../composables/useSelection';
import type { Account, Bank } from '../accounts/accounts.types';
import { formatMoney } from '../operations/money';
import {
  categoryLabel,
  paymentMethodIcon,
  paymentMethodName,
} from '../operations/operations.types';
import type { Category, PaymentMethod } from '../operations/operations.types';
import SchedulerForm from './SchedulerForm.vue';
import BatchActions from './batch.vue';
import type { Scheduler, SchedulerList } from './schedulers.types';
import IconButton from '../../components/IconButton.vue';
import PagerNav from '../../components/PagerNav.vue';
import AppIcon from '../../components/AppIcon.vue';

const route = useRoute();
const accountId = computed(() => route.params.accountId as string);

const queryClient = useQueryClient();

const page = ref(1);
watch(accountId, () => {
  page.value = 1;
});

const showForm = ref(false);
const editingScheduler = ref<Scheduler | null>(null);
const { selectedIds, selectedIdList, toggleSelected } = useSelection();

const accountsQuery = useQuery({
  queryKey: ['accounts'],
  queryFn: async () => {
    const { data } = await apiClient.GET('/accounts');
    return (data as Account[] | undefined) ?? [];
  },
});
const accounts = computed(() => accountsQuery.data.value ?? []);
const account = computed(() => accounts.value.find((a) => a.id === accountId.value) ?? null);

const banksQuery = useQuery({
  queryKey: ['banks'],
  queryFn: async () => {
    const { data } = await apiClient.GET('/banks');
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
  queryKey: ['categories'],
  queryFn: async () => {
    const { data } = await apiClient.GET('/reference-data/categories');
    return (data as Category[] | undefined) ?? [];
  },
});
const categories = computed(() => categoriesQuery.data.value ?? []);

const paymentMethodsQuery = useQuery({
  queryKey: ['payment-methods'],
  queryFn: async () => {
    const { data } = await apiClient.GET('/reference-data/payment-methods');
    return (data as PaymentMethod[] | undefined) ?? [];
  },
});
const paymentMethods = computed(() => paymentMethodsQuery.data.value ?? []);

const schedulersQuery = useQuery({
  queryKey: computed(() => ['schedulers', accountId.value, page.value]),
  queryFn: async () => {
    const { data } = await apiClient.GET('/schedulers', {
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

const categoryNames = computed(
  () => new Map(categories.value.map((c) => [c.id, categoryLabel(c, categories.value)])),
);

async function reloadSchedulers() {
  await queryClient.invalidateQueries({ queryKey: ['schedulers', accountId.value, page.value] });
}

function amountLabel(scheduler: Scheduler): string {
  const minorUnits = scheduler.debit ?? scheduler.credit ?? 0;
  return formatMoney(minorUnits, account.value?.currency ?? 'USD');
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
</script>

<template>
  <div>
    <router-link
      v-if="account"
      :to="{ name: 'operations', params: { accountId } }"
      class="back-link"
    >
      ← {{ account.name }} · {{ $t('operations.title') }}
    </router-link>
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h1 class="mb-0" style="font-size: 24px">
        {{ $t('schedulers.title') }}<span v-if="account"> — {{ account.name }}</span>
      </h1>
      <button
        v-if="isAccountFullyActive"
        type="button"
        class="btn btn-primary d-inline-flex align-items-center gap-1"
        @click="startCreate"
      >
        <AppIcon name="plus" :size="16" />
        {{ $t('schedulers.addScheduler') }}
      </button>
    </div>

    <BatchActions :selected-ids="selectedIdList" @done="reloadSchedulers" />

    <p v-if="list.items.length === 0" class="text-muted">{{ $t('schedulers.empty') }}</p>

    <div v-else>
      <div class="table-responsive">
        <table class="table" data-testid="schedulers-table">
          <thead>
            <tr>
              <th></th>
              <th></th>
              <th>{{ $t('operations.thirdParty') }}</th>
              <th class="text-end">{{ $t('operations.amount') }}</th>
              <th>{{ $t('operations.paymentMethod') }}</th>
              <th>{{ $t('operations.category') }}</th>
              <th class="text-end">{{ $t('schedulers.every') }}</th>
              <th>{{ $t('schedulers.frequencyUnit') }}</th>
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
                <span
                  class="dot"
                  :class="{ 'dot-active': scheduler.active }"
                  :title="scheduler.active ? $t('schedulers.active') : $t('schedulers.paused')"
                ></span>
              </td>
              <td>{{ scheduler.thirdParty }}</td>
              <td class="text-end amount" :class="scheduler.debit ? 'text-danger' : 'text-success'">
                {{ scheduler.debit ? '-' : '+' }}{{ amountLabel(scheduler) }}
              </td>
              <td :title="paymentMethodName(scheduler.paymentMethodId, paymentMethods)">
                {{ paymentMethodIcon(scheduler.paymentMethodId) }}
              </td>
              <td>{{ scheduler.categoryId ? categoryNames.get(scheduler.categoryId) : '' }}</td>
              <td class="text-end">{{ scheduler.frequencyValue }}</td>
              <td>{{ $t(`schedulers.units.${scheduler.frequencyUnit}`) }}</td>
              <td @click.stop>
                <IconButton
                  icon="edit"
                  :label="$t('operations.edit')"
                  @click="startEdit(scheduler)"
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
  </div>
</template>

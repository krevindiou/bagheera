<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { apiClient } from '../../api/client';
import { useToast } from '../../composables/useToast';
import { useConfirm } from '../../composables/useConfirm';
import { formatMoney } from '../operations/money';
import type { Bank, Account } from './accounts.types';
import BankChoiceForm from './BankChoiceForm.vue';
import CreateAccountForm from './CreateAccountForm.vue';
import EditBankForm from './EditBankForm.vue';
import IconButton from '../../components/IconButton.vue';
import ToastContainer from '../../components/ToastContainer.vue';

const { push: toast } = useToast();
const { confirm } = useConfirm();
const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const queryClient = useQueryClient();

const banksQuery = useQuery({
  queryKey: ['banks'],
  queryFn: async () => {
    const { data } = await apiClient.GET('/banks');
    return (data as Bank[] | undefined) ?? [];
  },
});
const banks = computed(() => banksQuery.data.value ?? []);

const accountsQuery = useQuery({
  queryKey: ['accounts'],
  queryFn: async () => {
    const { data } = await apiClient.GET('/accounts');
    return (data as Account[] | undefined) ?? [];
  },
});
const accounts = computed(() => accountsQuery.data.value ?? []);

async function reload() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['banks'] }),
    queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  ]);
}

// "New account" starts with a bank-choice step; only once a bank is
// chosen/created does account creation, pre-scoped to it, show.
const creationStep = ref<'closed' | 'bank-choice' | 'account'>('closed');
const chosenBankId = ref<string | null>(null);
const editingBankId = ref<string | null>(null);
const editingAccountId = ref<string | null>(null);

function startCreateAccount() {
  creationStep.value = 'bank-choice';
}

async function onBankChosen(bankId: string) {
  // Reload so a freshly created bank is in `banks` (and thus in the
  // account form's bank dropdown) before pre-selecting it.
  await reload();
  chosenBankId.value = bankId;
  creationStep.value = 'account';
}

function cancelCreateAccount() {
  creationStep.value = 'closed';
  chosenBankId.value = null;
}

// The dashboard's onboarding tips deep-link here via a `start` query
// param so they land directly in the relevant flow instead of the plain
// accounts list. Runs once, as soon as banks first load.
const startedFromQuery = ref(false);
watch(
  () => banksQuery.data.value,
  (data) => {
    if (startedFromQuery.value || !data) return;
    startedFromQuery.value = true;
    if (route.query.start === 'bank-choice') {
      creationStep.value = 'bank-choice';
    } else if (route.query.start === 'new-account' && activeBanks.value.length > 0) {
      chosenBankId.value = activeBanks.value[0]!.id;
      creationStep.value = 'account';
    }
  },
  { immediate: true },
);

function accountsForBank(bankId: string) {
  return accounts.value.filter((account) => account.bankId === bankId);
}

const activeBanks = computed(() => banks.value.filter((bank) => !bank.closed && !bank.deleted));

// -- Edit bank name --
function startEditBank(bank: Bank) {
  editingBankId.value = bank.id;
}
const editingBank = computed(() => banks.value.find((b) => b.id === editingBankId.value) ?? null);

async function onBankSaved() {
  editingBankId.value = null;
  await reload();
}

async function closeBank(bank: Bank) {
  if (!(await confirm())) return;
  const { response } = await apiClient.POST('/banks/{id}/close', {
    params: { path: { id: bank.id } },
  });
  if (!response.ok) {
    toast(t('accounts.genericError'), 'error');
    return;
  }
  toast(t('accounts.bankClosed'), 'success');
  await reload();
}

async function deleteBank(bank: Bank) {
  if (!(await confirm())) return;
  const { response } = await apiClient.DELETE('/banks/{id}', { params: { path: { id: bank.id } } });
  if (!response.ok) {
    toast(t('accounts.genericError'), 'error');
    return;
  }
  toast(t('accounts.bankDeleted'), 'success');
  await reload();
}

// -- Edit account (reuses the creation form, with bank and currency
// shown read-only, see CreateAccountForm's `mode="edit"`) --
function startEditAccount(account: Account) {
  editingAccountId.value = account.id;
}
const editingAccount = computed(
  () => accounts.value.find((a) => a.id === editingAccountId.value) ?? null,
);

async function onAccountUpdated() {
  editingAccountId.value = null;
  await reload();
}

async function closeAccount(account: Account) {
  if (!(await confirm())) return;
  const { response } = await apiClient.POST('/accounts/{id}/close', {
    params: { path: { id: account.id } },
  });
  if (!response.ok) {
    toast(t('accounts.genericError'), 'error');
    return;
  }
  toast(t('accounts.accountClosed'), 'success');
  await reload();
}

async function deleteAccount(account: Account) {
  if (!(await confirm())) return;
  const { response } = await apiClient.DELETE('/accounts/{id}', {
    params: { path: { id: account.id } },
  });
  if (!response.ok) {
    toast(t('accounts.genericError'), 'error');
    return;
  }
  toast(t('accounts.accountDeleted'), 'success');
  await reload();
}

// Clicking anywhere in a row (outside its checkbox/controls) opens the
// row's primary destination — here, the account's operations.
function goToAccount(account: Account) {
  router.push({ name: 'operations', params: { accountId: account.id } });
}

async function onAccountCreated(accountId: string) {
  creationStep.value = 'closed';
  chosenBankId.value = null;
  router.push({ name: 'operations', params: { accountId } });
}
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h1 class="mb-0">{{ $t('accounts.title') }}</h1>
      <button
        v-if="creationStep === 'closed'"
        type="button"
        class="btn btn-primary"
        @click="startCreateAccount"
      >
        + {{ $t('accounts.addAccount') }}
      </button>
    </div>
    <ToastContainer />

    <p v-if="banks.length === 0" class="text-muted">{{ $t('accounts.empty') }}</p>

    <section v-for="bank in banks" :key="bank.id" class="mb-4" data-testid="bank-row">
      <div class="d-flex align-items-center gap-2 mb-2">
        <h2 class="h6 mb-0" style="font-size: 15px">{{ bank.name }}</h2>
        <span v-if="bank.closed" class="pill pill-amber">{{ $t('accounts.closed') }}</span>
        <span v-if="bank.deleted" class="pill pill-danger">{{ $t('accounts.deleted') }}</span>
        <div class="ms-auto d-flex gap-2">
          <IconButton
            v-if="!bank.closed && !bank.deleted"
            icon="edit"
            :label="$t('accounts.edit')"
            @click="startEditBank(bank)"
          />
          <IconButton
            v-if="!bank.closed && !bank.deleted"
            icon="archive"
            :label="$t('accounts.close')"
            @click="closeBank(bank)"
          />
          <IconButton
            v-if="!bank.deleted"
            icon="trash"
            danger
            :label="$t('accounts.delete')"
            @click="deleteBank(bank)"
          />
        </div>
      </div>

      <p v-if="accountsForBank(bank.id).length === 0" class="text-muted ms-1 mb-0">
        {{ $t('accounts.noAccountsForBank') }}
      </p>
      <div v-else class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>{{ $t('accounts.account') }}</th>
              <th class="text-end">{{ $t('accounts.balance') }}</th>
              <th class="text-end">{{ $t('dashboard.totalReconciled') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="account in accountsForBank(bank.id)"
              :key="account.id"
              style="cursor: pointer"
              data-testid="account-row"
              @click="goToAccount(account)"
            >
              <td>
                <div class="d-flex align-items-center gap-2">
                  <router-link
                    :to="{ name: 'operations', params: { accountId: account.id } }"
                    @click.stop
                  >
                    {{ account.name }} ({{ account.currency }})
                  </router-link>
                  <span v-if="account.closed" class="pill pill-amber">{{
                    $t('accounts.closed')
                  }}</span>
                  <span v-if="account.deleted" class="pill pill-danger">{{
                    $t('accounts.deleted')
                  }}</span>
                </div>
              </td>
              <td class="text-end">
                <span class="amount" data-testid="account-balance">{{
                  formatMoney(account.balance ?? 0, account.currency, true)
                }}</span>
              </td>
              <td class="text-end">
                <span class="amount" data-testid="account-reconciled-balance">
                  {{ formatMoney(account.reconciledBalance ?? 0, account.currency, true) }}
                </span>
              </td>
              <td @click.stop>
                <div class="d-flex justify-content-end gap-2">
                  <IconButton
                    v-if="!account.closed && !account.deleted"
                    icon="edit"
                    :label="$t('accounts.edit')"
                    @click="startEditAccount(account)"
                  />
                  <IconButton
                    v-if="!account.closed && !account.deleted"
                    icon="archive"
                    :label="$t('accounts.close')"
                    @click="closeAccount(account)"
                  />
                  <IconButton
                    v-if="!account.deleted"
                    icon="trash"
                    danger
                    :label="$t('accounts.delete')"
                    @click="deleteAccount(account)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <BankChoiceForm
      v-if="creationStep === 'bank-choice'"
      :banks="activeBanks"
      @chosen="onBankChosen"
      @cancel="cancelCreateAccount"
    />
    <CreateAccountForm
      v-else-if="creationStep === 'account' && chosenBankId !== null"
      :banks="activeBanks"
      :bank-id="chosenBankId"
      @created="onAccountCreated"
      @cancel="cancelCreateAccount"
    />

    <CreateAccountForm
      v-if="editingAccount"
      mode="edit"
      :banks="banks"
      :account="editingAccount"
      @updated="onAccountUpdated"
      @cancel="editingAccountId = null"
    />

    <EditBankForm
      v-if="editingBank"
      :bank="editingBank"
      @saved="onBankSaved"
      @cancel="editingBankId = null"
    />
  </div>
</template>

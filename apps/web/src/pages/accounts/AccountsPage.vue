<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import { apiClient } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';
import { queryKeys } from '../../api/queryKeys';
import { useAccountsQuery, useBanksQuery } from '../../composables/useReferenceQueries';
import { useToast } from '../../composables/useToast';
import { useConfirm, type ConfirmOptions } from '../../composables/useConfirm';
import { formatMoney } from '../../domain/money';
import type { Bank, Account } from './accounts.types';
import BankChoiceForm from './BankChoiceForm.vue';
import CreateAccountForm from './CreateAccountForm.vue';
import EditBankForm from './EditBankForm.vue';
import IconButton from '../../components/IconButton.vue';
import AppIcon from '../../components/AppIcon.vue';
import ListState from '../../components/ListState.vue';

const { push: toast } = useToast();
const { confirm } = useConfirm();
const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const queryClient = useQueryClient();

const { banks, banksQuery } = useBanksQuery();
const { accounts, accountsQuery } = useAccountsQuery();
const banksPending = computed(() => banksQuery.isPending.value);
// Rows pair a bank with its accounts, so either query failing leaves the
// list unusable.
const listError = computed(() => banksQuery.isError.value || accountsQuery.isError.value);

async function reload() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.banks }),
    queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
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
      chosenBankId.value = activeBanks.value[0].id;
      creationStep.value = 'account';
    }
  },
  { immediate: true },
);

function accountsForBank(bankId: string) {
  return accounts.value.filter((account) => account.bankId === bankId);
}

const activeBanks = computed(() => banks.value.filter((bank) => !bank.closed && !bank.deleted));

// Names each row action button for its own bank/account, so a screen reader
// doesn't hear a run of identical "Edit"/"Close"/"Delete" buttons.
function bankActionLabel(action: string, bank: Bank): string {
  return t('common.actionOn', { action, name: bank.name });
}
function accountActionLabel(action: string, account: Account): string {
  return t('common.actionOn', { action, name: account.name });
}

// -- Edit bank name --
function startEditBank(bank: Bank) {
  editingBankId.value = bank.id;
}
const editingBank = computed(() => banks.value.find((b) => b.id === editingBankId.value) ?? null);

async function onBankSaved() {
  editingBankId.value = null;
  await reload();
}

// Shared by the four row actions below: confirm, send the request, toast
// the API's error (or the generic one) on failure, else the success toast
// and a reload.
async function confirmAndRun(
  confirmation: ConfirmOptions,
  request: () => Promise<{ error?: unknown; response: Response }>,
  successKey: string,
) {
  if (!(await confirm(confirmation))) return;
  const { error, response } = await request();
  if (!response.ok) {
    toast(errorMessage(error) ?? t('accounts.genericError'), 'error');
    return;
  }
  toast(t(successKey), 'success');
  await reload();
}

async function closeBank(bank: Bank) {
  await confirmAndRun(
    {
      body: t('accounts.confirmCloseBank', { name: bank.name }),
      confirmLabel: t('accounts.closeBank'),
    },
    () => apiClient.POST('/banks/{id}/close', { params: { path: { id: bank.id } } }),
    'accounts.bankClosed',
  );
}

async function deleteBank(bank: Bank) {
  await confirmAndRun(
    {
      body: t('accounts.confirmDeleteBank', { name: bank.name }),
      confirmLabel: t('accounts.delete'),
      danger: true,
    },
    () => apiClient.DELETE('/banks/{id}', { params: { path: { id: bank.id } } }),
    'accounts.bankDeleted',
  );
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
  await confirmAndRun(
    {
      body: t('accounts.confirmCloseAccount', { name: account.name }),
      confirmLabel: t('accounts.closeAccount'),
    },
    () => apiClient.POST('/accounts/{id}/close', { params: { path: { id: account.id } } }),
    'accounts.accountClosed',
  );
}

async function deleteAccount(account: Account) {
  await confirmAndRun(
    {
      body: t('accounts.confirmDeleteAccount', { name: account.name }),
      confirmLabel: t('accounts.delete'),
      danger: true,
    },
    () => apiClient.DELETE('/accounts/{id}', { params: { path: { id: account.id } } }),
    'accounts.accountDeleted',
  );
}

// Clicking anywhere in a row (outside its checkbox/controls) opens the
// row's primary destination — here, the account's operations.
function goToAccount(account: Account) {
  void router.push({ name: 'operations', params: { accountId: account.id } });
}

function onAccountCreated(accountId: string) {
  creationStep.value = 'closed';
  chosenBankId.value = null;
  void router.push({ name: 'operations', params: { accountId } });
}
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h1 class="mb-0">{{ $t('accounts.title') }}</h1>
      <button
        v-if="creationStep === 'closed'"
        type="button"
        class="btn btn-primary d-inline-flex align-items-center gap-1"
        @click="startCreateAccount"
      >
        <AppIcon name="plus" :size="16" />
        {{ $t('accounts.addAccount') }}
      </button>
    </div>

    <ListState
      :error="listError"
      :loading="banksPending"
      :empty="banks.length === 0"
      :empty-text="$t('accounts.empty')"
      error-testid="accounts-error"
    >
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
              :aria-label="bankActionLabel($t('accounts.edit'), bank)"
              @click="startEditBank(bank)"
            />
            <IconButton
              v-if="!bank.closed && !bank.deleted"
              icon="archive"
              :label="$t('accounts.closeBank')"
              :aria-label="bankActionLabel($t('accounts.closeBank'), bank)"
              @click="closeBank(bank)"
            />
            <IconButton
              v-if="!bank.deleted"
              icon="trash"
              danger
              :label="$t('accounts.delete')"
              :aria-label="bankActionLabel($t('accounts.delete'), bank)"
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
                  <span
                    class="amount"
                    :class="{ 'text-danger': (account.balance ?? 0) < 0 }"
                    data-testid="account-balance"
                    >{{ formatMoney(account.balance ?? 0, account.currency) }}</span
                  >
                </td>
                <td class="text-end">
                  <span
                    class="amount"
                    :class="{ 'text-danger': (account.reconciledBalance ?? 0) < 0 }"
                    data-testid="account-reconciled-balance"
                  >
                    {{ formatMoney(account.reconciledBalance ?? 0, account.currency) }}
                  </span>
                </td>
                <td @click.stop>
                  <div class="d-flex justify-content-end gap-2">
                    <IconButton
                      v-if="!account.closed && !account.deleted"
                      icon="edit"
                      :label="$t('accounts.edit')"
                      :aria-label="accountActionLabel($t('accounts.edit'), account)"
                      @click="startEditAccount(account)"
                    />
                    <IconButton
                      v-if="!account.closed && !account.deleted"
                      icon="archive"
                      :label="$t('accounts.closeAccount')"
                      :aria-label="accountActionLabel($t('accounts.closeAccount'), account)"
                      @click="closeAccount(account)"
                    />
                    <IconButton
                      v-if="!account.deleted"
                      icon="trash"
                      danger
                      :label="$t('accounts.delete')"
                      :aria-label="accountActionLabel($t('accounts.delete'), account)"
                      @click="deleteAccount(account)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </ListState>

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

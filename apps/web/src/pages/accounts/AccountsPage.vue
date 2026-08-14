<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useI18n } from "vue-i18n";
import { apiClient } from "../../api/client";
import { useToast } from "../../composables/useToast";
import { useConfirm } from "../../composables/useConfirm";
import { editBankSchema, editAccountSchema } from "./accounts.schemas";
import type { Bank, Account } from "./accounts.types";
import CreateAccountForm from "./CreateAccountForm.vue";

const { push: toast } = useToast();
const { confirm } = useConfirm();
const { t } = useI18n();

const banks = ref<Bank[]>([]);
const accounts = ref<Account[]>([]);
const showCreateForm = ref(false);
const editingBankId = ref<number | null>(null);
const editingAccountId = ref<number | null>(null);

async function load() {
  const [banksResult, accountsResult] = await Promise.all([
    apiClient.GET("/banks"),
    apiClient.GET("/accounts"),
  ]);
  banks.value = (banksResult.data as Bank[] | undefined) ?? [];
  accounts.value = (accountsResult.data as Account[] | undefined) ?? [];
}

onMounted(load);

function accountsForBank(bankId: number) {
  return accounts.value.filter((account) => account.bankId === bankId);
}

const activeBanks = computed(() => banks.value.filter((bank) => !bank.closed && !bank.deleted));

// -- Edit bank name --
const {
  defineField: defineBankField,
  handleSubmit: handleBankSubmit,
  errors: bankErrors,
  setValues: setBankValues,
} = useForm({ validationSchema: toTypedSchema(editBankSchema) });
const [editBankName, editBankNameAttrs] = defineBankField("name");

function startEditBank(bank: Bank) {
  editingBankId.value = bank.id;
  setBankValues({ name: bank.name });
}

const submitEditBank = handleBankSubmit(async (values) => {
  const id = editingBankId.value;
  if (id === null) return;
  const { error, response } = await apiClient.PATCH("/banks/{id}", {
    params: { path: { id } },
    body: values,
  });
  if (!response.ok) {
    toast(errorMessage(error) ?? t("accounts.genericError"), "error");
    return;
  }
  editingBankId.value = null;
  toast(t("accounts.bankUpdated"), "success");
  await load();
});

async function closeBank(bank: Bank) {
  if (!(await confirm(t("accounts.closeBankConfirm", { name: bank.name })))) return;
  const { response } = await apiClient.POST("/banks/{id}/close", { params: { path: { id: bank.id } } });
  if (!response.ok) {
    toast(t("accounts.genericError"), "error");
    return;
  }
  await load();
}

async function deleteBank(bank: Bank) {
  if (!(await confirm(t("accounts.deleteBankConfirm", { name: bank.name })))) return;
  const { response } = await apiClient.DELETE("/banks/{id}", { params: { path: { id: bank.id } } });
  if (!response.ok) {
    toast(t("accounts.genericError"), "error");
    return;
  }
  await load();
}

// -- Edit account name --
const {
  defineField: defineAccountField,
  handleSubmit: handleAccountSubmit,
  errors: accountErrors,
  setValues: setAccountValues,
} = useForm({ validationSchema: toTypedSchema(editAccountSchema) });
const [editAccountName, editAccountNameAttrs] = defineAccountField("name");

function startEditAccount(account: Account) {
  editingAccountId.value = account.id;
  setAccountValues({ name: account.name });
}

const submitEditAccount = handleAccountSubmit(async (values) => {
  const id = editingAccountId.value;
  const account = accounts.value.find((a) => a.id === id);
  if (!account) return;
  const { error, response } = await apiClient.PATCH("/accounts/{id}", {
    params: { path: { id: account.id } },
    body: { name: values.name, bankId: account.bankId, currency: account.currency },
  });
  if (!response.ok) {
    toast(errorMessage(error) ?? t("accounts.genericError"), "error");
    return;
  }
  editingAccountId.value = null;
  toast(t("accounts.accountUpdated"), "success");
  await load();
});

async function closeAccount(account: Account) {
  if (!(await confirm(t("accounts.closeAccountConfirm", { name: account.name })))) return;
  const { response } = await apiClient.POST("/accounts/{id}/close", {
    params: { path: { id: account.id } },
  });
  if (!response.ok) {
    toast(t("accounts.genericError"), "error");
    return;
  }
  await load();
}

async function deleteAccount(account: Account) {
  if (!(await confirm(t("accounts.deleteAccountConfirm", { name: account.name })))) return;
  const { response } = await apiClient.DELETE("/accounts/{id}", {
    params: { path: { id: account.id } },
  });
  if (!response.ok) {
    toast(t("accounts.genericError"), "error");
    return;
  }
  await load();
}

async function onAccountCreated() {
  showCreateForm.value = false;
  await load();
}

function errorMessage(error: unknown): string | undefined {
  if (error && typeof error === "object" && "message" in error) {
    const { message } = error as { message: string | string[] };
    return Array.isArray(message) ? message[0] : message;
  }
  return undefined;
}
</script>

<template>
  <div class="container py-5" style="max-width: 720px">
    <h1>{{ $t("accounts.title") }}</h1>

    <p v-if="banks.length === 0" class="text-muted">{{ $t("accounts.empty") }}</p>

    <section v-for="bank in banks" :key="bank.id" class="mb-4" data-testid="bank-row">
      <div class="d-flex align-items-center gap-2">
        <template v-if="editingBankId === bank.id">
          <form novalidate class="d-flex align-items-center gap-2 flex-grow-1" @submit="submitEditBank">
            <input
              v-model="editBankName"
              v-bind="editBankNameAttrs"
              type="text"
              class="form-control form-control-sm w-auto"
              :class="{ 'is-invalid': bankErrors.name }"
            />
            <button type="submit" class="btn btn-sm btn-primary">{{ $t("accounts.submit") }}</button>
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              @click="editingBankId = null"
            >
              {{ $t("common.cancel") }}
            </button>
          </form>
        </template>
        <template v-else>
          <h2 class="h5 mb-0">{{ bank.name }}</h2>
          <span v-if="bank.closed" class="badge text-bg-secondary">{{ $t("accounts.closed") }}</span>
          <span v-if="bank.deleted" class="badge text-bg-danger">{{ $t("accounts.deleted") }}</span>
          <div class="ms-auto d-flex gap-2">
            <button
              v-if="!bank.closed && !bank.deleted"
              type="button"
              class="btn btn-sm btn-outline-secondary"
              @click="startEditBank(bank)"
            >
              {{ $t("accounts.edit") }}
            </button>
            <button
              v-if="!bank.closed && !bank.deleted"
              type="button"
              class="btn btn-sm btn-outline-secondary"
              @click="closeBank(bank)"
            >
              {{ $t("accounts.close") }}
            </button>
            <button
              v-if="!bank.deleted"
              type="button"
              class="btn btn-sm btn-outline-danger"
              @click="deleteBank(bank)"
            >
              {{ $t("accounts.delete") }}
            </button>
          </div>
        </template>
      </div>

      <ul class="list-unstyled ms-3 mt-2">
        <li
          v-for="account in accountsForBank(bank.id)"
          :key="account.id"
          class="d-flex align-items-center gap-2 py-1"
          data-testid="account-row"
        >
          <template v-if="editingAccountId === account.id">
            <form
              novalidate
              class="d-flex align-items-center gap-2 flex-grow-1"
              @submit="submitEditAccount"
            >
              <input
                v-model="editAccountName"
                v-bind="editAccountNameAttrs"
                type="text"
                class="form-control form-control-sm w-auto"
                :class="{ 'is-invalid': accountErrors.name }"
              />
              <button type="submit" class="btn btn-sm btn-primary">{{ $t("accounts.submit") }}</button>
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary"
                @click="editingAccountId = null"
              >
                {{ $t("common.cancel") }}
              </button>
            </form>
          </template>
          <template v-else>
            <router-link :to="{ name: 'operations', params: { accountId: account.id } }">
              {{ account.name }} ({{ account.currency }})
            </router-link>
            <span v-if="account.closed" class="badge text-bg-secondary">
              {{ $t("accounts.closed") }}
            </span>
            <span v-if="account.deleted" class="badge text-bg-danger">
              {{ $t("accounts.deleted") }}
            </span>
            <div class="ms-auto d-flex gap-2">
              <button
                v-if="!account.closed && !account.deleted"
                type="button"
                class="btn btn-sm btn-outline-secondary"
                @click="startEditAccount(account)"
              >
                {{ $t("accounts.edit") }}
              </button>
              <button
                v-if="!account.closed && !account.deleted"
                type="button"
                class="btn btn-sm btn-outline-secondary"
                @click="closeAccount(account)"
              >
                {{ $t("accounts.close") }}
              </button>
              <button
                v-if="!account.deleted"
                type="button"
                class="btn btn-sm btn-outline-danger"
                @click="deleteAccount(account)"
              >
                {{ $t("accounts.delete") }}
              </button>
            </div>
          </template>
        </li>
      </ul>
    </section>

    <CreateAccountForm v-if="showCreateForm" :banks="activeBanks" @created="onAccountCreated" @cancel="showCreateForm = false" />
    <button v-else type="button" class="btn btn-primary" @click="showCreateForm = true">
      {{ $t("accounts.addAccount") }}
    </button>
  </div>
</template>

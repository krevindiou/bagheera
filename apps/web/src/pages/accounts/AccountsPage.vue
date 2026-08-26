<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { apiClient } from "../../api/client";
import { useToast } from "../../composables/useToast";
import { useConfirm } from "../../composables/useConfirm";
import { editBankSchema, editAccountSchema } from "./accounts.schemas";
import type { Bank, Account } from "./accounts.types";
import BankChoiceForm from "./BankChoiceForm.vue";
import CreateAccountForm from "./CreateAccountForm.vue";

const { push: toast } = useToast();
const { confirm } = useConfirm();
const { t } = useI18n();
const router = useRouter();

const banks = ref<Bank[]>([]);
const accounts = ref<Account[]>([]);
// Spec 4.7: "New account" starts with a bank-choice step; only once a bank
// is chosen/created does account creation (4.8), pre-scoped to it, show.
const creationStep = ref<"closed" | "bank-choice" | "account">("closed");
const chosenBankId = ref<number | null>(null);
const editingBankId = ref<number | null>(null);
const editingAccountId = ref<number | null>(null);

function startCreateAccount() {
  creationStep.value = "bank-choice";
}

async function onBankChosen(bankId: number) {
  // Reload so a freshly created bank is in `banks` (and thus in the
  // account form's bank dropdown) before pre-selecting it.
  await load();
  chosenBankId.value = bankId;
  creationStep.value = "account";
}

function cancelCreateAccount() {
  creationStep.value = "closed";
  chosenBankId.value = null;
}

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
  toast(t("accounts.bankSaved"), "success");
  await load();
});

async function closeBank(bank: Bank) {
  if (!(await confirm())) return;
  const { response } = await apiClient.POST("/banks/{id}/close", {
    params: { path: { id: bank.id } },
  });
  if (!response.ok) {
    toast(t("accounts.genericError"), "error");
    return;
  }
  toast(t("accounts.bankClosed"), "success");
  await load();
}

async function deleteBank(bank: Bank) {
  if (!(await confirm())) return;
  const { response } = await apiClient.DELETE("/banks/{id}", { params: { path: { id: bank.id } } });
  if (!response.ok) {
    toast(t("accounts.genericError"), "error");
    return;
  }
  toast(t("accounts.bankDeleted"), "success");
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
  toast(t("accounts.accountSaved"), "success");
  await load();
});

async function closeAccount(account: Account) {
  if (!(await confirm())) return;
  const { response } = await apiClient.POST("/accounts/{id}/close", {
    params: { path: { id: account.id } },
  });
  if (!response.ok) {
    toast(t("accounts.genericError"), "error");
    return;
  }
  toast(t("accounts.accountClosed"), "success");
  await load();
}

async function deleteAccount(account: Account) {
  if (!(await confirm())) return;
  const { response } = await apiClient.DELETE("/accounts/{id}", {
    params: { path: { id: account.id } },
  });
  if (!response.ok) {
    toast(t("accounts.genericError"), "error");
    return;
  }
  toast(t("accounts.accountDeleted"), "success");
  await load();
}

// Spec 2.7: clicking anywhere in a row (outside its checkbox/controls)
// opens the row's primary destination — here, the account's operations.
function goToAccount(account: Account) {
  router.push({ name: "operations", params: { accountId: account.id } });
}

async function onAccountCreated(accountId: number) {
  creationStep.value = "closed";
  chosenBankId.value = null;
  router.push({ name: "operations", params: { accountId } });
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
          <form
            novalidate
            class="d-flex align-items-center gap-2 flex-grow-1"
            @submit="submitEditBank"
          >
            <input
              v-model="editBankName"
              v-bind="editBankNameAttrs"
              type="text"
              autofocus
              class="form-control form-control-sm w-auto"
              :class="{ 'is-invalid': bankErrors.name }"
            />
            <button type="submit" class="btn btn-sm btn-primary">
              {{ $t("accounts.submit") }}
            </button>
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
          <span v-if="bank.closed" class="badge text-bg-secondary">{{
            $t("accounts.closed")
          }}</span>
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

      <p v-if="accountsForBank(bank.id).length === 0" class="text-muted ms-3 mt-2 mb-0">
        {{ $t("accounts.noAccountsForBank") }}
      </p>
      <ul v-else class="list-unstyled ms-3 mt-2">
        <li
          v-for="account in accountsForBank(bank.id)"
          :key="account.id"
          class="d-flex align-items-center gap-2 py-1"
          data-testid="account-row"
          :style="editingAccountId === account.id ? undefined : 'cursor: pointer'"
          @click="editingAccountId === account.id || goToAccount(account)"
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
                autofocus
                class="form-control form-control-sm w-auto"
                :class="{ 'is-invalid': accountErrors.name }"
              />
              <button type="submit" class="btn btn-sm btn-primary">
                {{ $t("accounts.submit") }}
              </button>
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
            <router-link
              :to="{ name: 'operations', params: { accountId: account.id } }"
              @click.stop
            >
              {{ account.name }} ({{ account.currency }})
            </router-link>
            <span v-if="account.closed" class="badge text-bg-secondary">
              {{ $t("accounts.closed") }}
            </span>
            <span v-if="account.deleted" class="badge text-bg-danger">
              {{ $t("accounts.deleted") }}
            </span>
            <div class="ms-auto d-flex gap-2" @click.stop>
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
    <button v-else type="button" class="btn btn-primary" @click="startCreateAccount">
      {{ $t("accounts.addAccount") }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useI18n } from "vue-i18n";
import { apiClient } from "../../api/client";
import { useToast } from "../../composables/useToast";
import { getCurrencyOptions, getGuessedCurrency } from "../../composables/useCurrencyOptions";
import { currencySymbol } from "../operations/money";
import { createAccountSchema, type CreateAccountForm } from "./accounts.schemas";
import type { Bank } from "./accounts.types";

// Spec 4.8: reached after the bank-choice step (4.7) — pre-scoped to the
// chosen/created bank, but the bank field stays an editable dropdown of
// the member's active banks.
const props = defineProps<{ banks: Bank[]; bankId: number }>();
const emit = defineEmits<{ created: [accountId: number]; cancel: [] }>();

const { push: toast } = useToast();
const { t } = useI18n();
const currencyOptions = getCurrencyOptions();

const { defineField, handleSubmit, errors, isSubmitting } = useForm<CreateAccountForm>({
  validationSchema: toTypedSchema(createAccountSchema),
  initialValues: {
    bankId: props.bankId,
    name: "",
    currency: getGuessedCurrency(currencyOptions),
  },
});
const [selectedBankId, bankIdAttrs] = defineField("bankId");
const [name, nameAttrs] = defineField("name");
const [currency, currencyAttrs] = defineField("currency");
const [initialBalance, initialBalanceAttrs] = defineField("initialBalance");
const initialBalanceCurrencySymbol = computed(() =>
  currency.value ? currencySymbol(currency.value) : "",
);

const onSubmit = handleSubmit(async (values) => {
  const { data, error, response } = await apiClient.POST("/accounts", {
    body: {
      bankId: Number(values.bankId),
      name: values.name,
      currency: values.currency.toUpperCase(),
      initialBalance: values.initialBalance,
    },
  });
  if (!response.ok) {
    toast(errorMessage(error) ?? t("accounts.genericError"), "error");
    return;
  }

  toast(t("accounts.accountSaved"), "success");
  const created = data as unknown as { account: { id: number } };
  emit("created", created.account.id);
});

function errorMessage(error: unknown): string | undefined {
  if (error && typeof error === "object" && "message" in error) {
    const { message } = error as { message: string | string[] };
    return Array.isArray(message) ? message[0] : message;
  }
  return undefined;
}
</script>

<template>
  <form novalidate class="border rounded p-3 mb-4" @submit="onSubmit">
    <h2 class="h5">{{ $t("accounts.addAccount") }}</h2>

    <div class="mb-3">
      <label class="form-label" for="account-bank">{{ $t("accounts.bank") }}</label>
      <select
        id="account-bank"
        v-model="selectedBankId"
        v-bind="bankIdAttrs"
        autofocus
        class="form-select"
        :class="{ 'is-invalid': errors.bankId }"
      >
        <option v-for="bank in props.banks" :key="bank.id" :value="bank.id">
          {{ bank.name }}
        </option>
      </select>
    </div>

    <div class="mb-3">
      <label class="form-label" for="account-name">{{ $t("accounts.accountName") }}</label>
      <input
        id="account-name"
        v-model="name"
        v-bind="nameAttrs"
        type="text"
        class="form-control"
        :class="{ 'is-invalid': errors.name }"
      />
      <div v-if="errors.name" class="invalid-feedback">
        {{ $t("auth.validation.required") }}
      </div>
    </div>

    <div class="mb-3">
      <label class="form-label" for="account-currency">{{ $t("accounts.currency") }}</label>
      <select
        id="account-currency"
        v-model="currency"
        v-bind="currencyAttrs"
        class="form-select"
        :class="{ 'is-invalid': errors.currency }"
      >
        <option value="">{{ $t("accounts.chooseCurrency") }}</option>
        <option v-for="option in currencyOptions" :key="option.code" :value="option.code">
          {{ option.code }} — {{ option.name }}
        </option>
      </select>
      <div v-if="errors.currency" class="invalid-feedback">
        {{ $t("accounts.validation.currency") }}
      </div>
    </div>

    <div class="mb-3">
      <label class="form-label" for="account-initial-balance">
        {{ $t("accounts.initialBalance") }}
      </label>
      <div class="input-group">
        <span class="input-group-text">{{ initialBalanceCurrencySymbol }}</span>
        <input
          id="account-initial-balance"
          v-model="initialBalance"
          v-bind="initialBalanceAttrs"
          type="number"
          inputmode="decimal"
          step="0.01"
          class="form-control"
        />
      </div>
    </div>

    <div class="d-flex gap-2">
      <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
        {{ $t("accounts.submit") }}
      </button>
      <button type="button" class="btn btn-outline-secondary" @click="emit('cancel')">
        {{ $t("common.cancel") }}
      </button>
    </div>
  </form>
</template>

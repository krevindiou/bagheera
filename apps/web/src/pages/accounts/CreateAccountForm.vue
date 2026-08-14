<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useI18n } from "vue-i18n";
import { apiClient } from "../../api/client";
import { useToast } from "../../composables/useToast";
import { createAccountSchema, type CreateAccountForm } from "./accounts.schemas";
import type { Bank } from "./accounts.types";

const props = defineProps<{ banks: Bank[] }>();
const emit = defineEmits<{ created: []; cancel: [] }>();

const { push: toast } = useToast();
const { t } = useI18n();

const { defineField, handleSubmit, errors, isSubmitting } = useForm<CreateAccountForm>({
  validationSchema: toTypedSchema(createAccountSchema),
  initialValues: { bankId: "", bankName: "", name: "", currency: "" },
});
const [bankId, bankIdAttrs] = defineField("bankId");
const [bankName, bankNameAttrs] = defineField("bankName");
const [name, nameAttrs] = defineField("name");
const [currency, currencyAttrs] = defineField("currency");
const [initialBalance, initialBalanceAttrs] = defineField("initialBalance");

const onSubmit = handleSubmit(async (values) => {
  let resolvedBankId: number;

  if (values.bankId) {
    resolvedBankId = Number(values.bankId);
  } else {
    const { data, error, response } = await apiClient.POST("/banks/choice", {
      body: { name: values.bankName },
    });
    if (!response.ok) {
      toast(errorMessage(error) ?? t("accounts.genericError"), "error");
      return;
    }
    resolvedBankId = (data as unknown as { id: number }).id;
  }

  const { error, response } = await apiClient.POST("/accounts", {
    body: {
      bankId: resolvedBankId,
      name: values.name,
      currency: values.currency.toUpperCase(),
      initialBalance: values.initialBalance,
    },
  });
  if (!response.ok) {
    toast(errorMessage(error) ?? t("accounts.genericError"), "error");
    return;
  }

  toast(t("accounts.accountCreated"), "success");
  emit("created");
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
      <label class="form-label" for="account-bank-id">{{ $t("accounts.existingBank") }}</label>
      <select
        id="account-bank-id"
        v-model="bankId"
        v-bind="bankIdAttrs"
        class="form-select"
        :class="{ 'is-invalid': errors.bankId }"
      >
        <option value="">{{ $t("accounts.chooseBank") }}</option>
        <option v-for="bank in props.banks" :key="bank.id" :value="bank.id">
          {{ bank.name }}
        </option>
      </select>
    </div>

    <div class="mb-3">
      <label class="form-label" for="account-bank-name">{{ $t("accounts.newBankName") }}</label>
      <input
        id="account-bank-name"
        v-model="bankName"
        v-bind="bankNameAttrs"
        type="text"
        class="form-control"
        :class="{ 'is-invalid': errors.bankName }"
      />
      <div v-if="errors.bankName" class="invalid-feedback">
        {{ $t("accounts.validation.bankChoiceRequired") }}
      </div>
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
      <input
        id="account-currency"
        v-model="currency"
        v-bind="currencyAttrs"
        type="text"
        maxlength="3"
        class="form-control"
        :class="{ 'is-invalid': errors.currency }"
      />
      <div v-if="errors.currency" class="invalid-feedback">
        {{ $t("accounts.validation.currency") }}
      </div>
    </div>

    <div class="mb-3">
      <label class="form-label" for="account-initial-balance">
        {{ $t("accounts.initialBalance") }}
      </label>
      <input
        id="account-initial-balance"
        v-model="initialBalance"
        v-bind="initialBalanceAttrs"
        type="number"
        step="0.01"
        class="form-control"
      />
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

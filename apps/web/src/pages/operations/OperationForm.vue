<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useI18n } from "vue-i18n";
import { apiClient } from "../../api/client";
import { useToast } from "../../composables/useToast";
import type { Account } from "../accounts/accounts.types";
import { toDisplayAmount } from "./money";
import { operationSchema, type OperationForm } from "./operations.schemas";
import {
  PAYMENT_METHODS,
  TRANSFER_PAYMENT_METHOD_IDS,
  type Category,
  type Operation,
} from "./operations.types";

const props = defineProps<{
  accountId: number;
  categories: Category[];
  accounts: Account[];
  operation?: Operation | null;
}>();
const emit = defineEmits<{ saved: []; cancel: [] }>();

const { push: toast } = useToast();
const { t } = useI18n();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function initialValues(): OperationForm {
  const op = props.operation;
  if (!op) {
    return {
      type: "debit",
      thirdParty: "",
      amount: undefined as unknown as number,
      categoryId: undefined,
      paymentMethodId: undefined as unknown as number,
      transferAccountId: undefined,
      valueDate: today(),
      notes: "",
      reconciled: false,
    };
  }
  return {
    type: op.debit !== null ? "debit" : "credit",
    thirdParty: op.thirdParty,
    amount: toDisplayAmount((op.debit ?? op.credit)!),
    categoryId: op.categoryId ?? undefined,
    paymentMethodId: op.paymentMethodId,
    transferAccountId: op.transferAccountId ?? undefined,
    valueDate: op.valueDate,
    notes: op.notes,
    reconciled: op.reconciled,
  };
}

const { defineField, handleSubmit, errors, isSubmitting } = useForm<OperationForm>({
  validationSchema: toTypedSchema(operationSchema),
  initialValues: initialValues(),
});
const [type, typeAttrs] = defineField("type");
const [thirdParty, thirdPartyAttrs] = defineField("thirdParty");
const [amount, amountAttrs] = defineField("amount");
const [categoryId, categoryIdAttrs] = defineField("categoryId");
const [paymentMethodId, paymentMethodIdAttrs] = defineField("paymentMethodId");
const [transferAccountId, transferAccountIdAttrs] = defineField("transferAccountId");
const [valueDate, valueDateAttrs] = defineField("valueDate");
const [notes, notesAttrs] = defineField("notes");
const [reconciled, reconciledAttrs] = defineField("reconciled");

// Type-driven filtering: category and payment-method choices only ever
// show options matching the selected debit/credit type.
const filteredCategories = computed(() => props.categories.filter((c) => c.type === type.value));
const filteredPaymentMethods = computed(() =>
  PAYMENT_METHODS.filter((pm) => pm.type === type.value),
);
const transferTargets = computed(() => props.accounts.filter((a) => a.id !== props.accountId));
const showTransferAccount = computed(() =>
  TRANSFER_PAYMENT_METHOD_IDS.includes(Number(paymentMethodId.value)),
);

// Switching type invalidates the previous category/payment-method choice.
watch(type, () => {
  categoryId.value = undefined;
  paymentMethodId.value = undefined as unknown as number;
});

interface ThirdPartySuggestion {
  thirdParty: string;
  categoryId: number | null;
}

const suggestions = ref<ThirdPartySuggestion[]>([]);
let debounceHandle: ReturnType<typeof setTimeout> | undefined;

watch(thirdParty, (value) => {
  if (debounceHandle) clearTimeout(debounceHandle);
  const query = value?.trim() ?? "";
  if (query.length < 2) {
    suggestions.value = [];
    return;
  }
  debounceHandle = setTimeout(async () => {
    const { data } = await apiClient.GET("/operations/autocomplete", {
      params: { query: { q: query, type: type.value } },
    });
    suggestions.value = (data as ThirdPartySuggestion[] | undefined) ?? [];
    const exact = suggestions.value.find((s) => s.thirdParty.toLowerCase() === query.toLowerCase());
    if (exact?.categoryId) {
      categoryId.value = exact.categoryId;
    }
  }, 300);
});

const onSubmit = handleSubmit(async (submitted) => {
  const body = {
    accountId: props.accountId,
    type: submitted.type,
    thirdParty: submitted.thirdParty,
    amount: submitted.amount,
    categoryId: submitted.categoryId,
    paymentMethodId: submitted.paymentMethodId,
    transferAccountId: TRANSFER_PAYMENT_METHOD_IDS.includes(submitted.paymentMethodId)
      ? submitted.transferAccountId
      : undefined,
    valueDate: submitted.valueDate,
    notes: submitted.notes,
    reconciled: submitted.reconciled,
  };

  const { error, response } = props.operation
    ? await apiClient.PATCH("/operations/{id}", {
        params: { path: { id: props.operation.id } },
        body,
      })
    : await apiClient.POST("/operations", { body });

  if (!response.ok) {
    toast(errorMessage(error) ?? t("operations.genericError"), "error");
    return;
  }

  toast(t(props.operation ? "operations.updated" : "operations.created"), "success");
  emit("saved");
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
    <h2 class="h5">
      {{ $t(props.operation ? "operations.editTitle" : "operations.createTitle") }}
    </h2>

    <div class="mb-3">
      <div class="form-check form-check-inline">
        <input
          id="operation-type-debit"
          v-model="type"
          v-bind="typeAttrs"
          class="form-check-input"
          type="radio"
          value="debit"
        />
        <label class="form-check-label" for="operation-type-debit">{{
          $t("operations.debit")
        }}</label>
      </div>
      <div class="form-check form-check-inline">
        <input
          id="operation-type-credit"
          v-model="type"
          v-bind="typeAttrs"
          class="form-check-input"
          type="radio"
          value="credit"
        />
        <label class="form-check-label" for="operation-type-credit">{{
          $t("operations.credit")
        }}</label>
      </div>
    </div>

    <div class="mb-3 position-relative">
      <label class="form-label" for="operation-third-party">{{
        $t("operations.thirdParty")
      }}</label>
      <input
        id="operation-third-party"
        v-model="thirdParty"
        v-bind="thirdPartyAttrs"
        type="text"
        list="operation-third-party-suggestions"
        autocomplete="off"
        class="form-control"
        :class="{ 'is-invalid': errors.thirdParty }"
      />
      <datalist id="operation-third-party-suggestions">
        <option v-for="s in suggestions" :key="s.thirdParty" :value="s.thirdParty" />
      </datalist>
      <div v-if="errors.thirdParty" class="invalid-feedback">
        {{ $t("auth.validation.required") }}
      </div>
    </div>

    <div class="mb-3">
      <label class="form-label" for="operation-amount">{{ $t("operations.amount") }}</label>
      <input
        id="operation-amount"
        v-model="amount"
        v-bind="amountAttrs"
        type="number"
        inputmode="decimal"
        step="0.01"
        class="form-control"
        :class="{ 'is-invalid': errors.amount }"
      />
      <div v-if="errors.amount" class="invalid-feedback">
        {{ $t("operations.validation.amount") }}
      </div>
    </div>

    <div class="mb-3">
      <label class="form-label" for="operation-category">{{ $t("operations.category") }}</label>
      <select
        id="operation-category"
        v-model="categoryId"
        v-bind="categoryIdAttrs"
        class="form-select"
      >
        <option value="">{{ $t("operations.noCategory") }}</option>
        <option v-for="c in filteredCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </div>

    <div class="mb-3">
      <label class="form-label" for="operation-payment-method">{{
        $t("operations.paymentMethod")
      }}</label>
      <select
        id="operation-payment-method"
        v-model="paymentMethodId"
        v-bind="paymentMethodIdAttrs"
        class="form-select"
        :class="{ 'is-invalid': errors.paymentMethodId }"
      >
        <option value="">{{ $t("operations.choosePaymentMethod") }}</option>
        <option v-for="pm in filteredPaymentMethods" :key="pm.id" :value="pm.id">
          {{ pm.name }}
        </option>
      </select>
      <div v-if="errors.paymentMethodId" class="invalid-feedback">
        {{ $t("auth.validation.required") }}
      </div>
    </div>

    <div v-if="showTransferAccount" class="mb-3">
      <label class="form-label" for="operation-transfer-account">
        {{ $t("operations.transferAccount") }}
      </label>
      <select
        id="operation-transfer-account"
        v-model="transferAccountId"
        v-bind="transferAccountIdAttrs"
        class="form-select"
        :class="{ 'is-invalid': errors.transferAccountId }"
      >
        <option value="">{{ $t("operations.chooseTransferAccount") }}</option>
        <option v-for="a in transferTargets" :key="a.id" :value="a.id">{{ a.name }}</option>
      </select>
      <div v-if="errors.transferAccountId" class="invalid-feedback">
        {{ $t("auth.validation.required") }}
      </div>
    </div>

    <div class="mb-3">
      <label class="form-label" for="operation-value-date">{{ $t("operations.valueDate") }}</label>
      <input
        id="operation-value-date"
        v-model="valueDate"
        v-bind="valueDateAttrs"
        type="date"
        class="form-control"
      />
    </div>

    <div class="mb-3">
      <label class="form-label" for="operation-notes">{{ $t("operations.notes") }}</label>
      <textarea
        id="operation-notes"
        v-model="notes"
        v-bind="notesAttrs"
        class="form-control"
      ></textarea>
    </div>

    <div class="mb-3 form-check">
      <input
        id="operation-reconciled"
        v-model="reconciled"
        v-bind="reconciledAttrs"
        type="checkbox"
        class="form-check-input"
      />
      <label class="form-check-label" for="operation-reconciled">{{
        $t("operations.reconciled")
      }}</label>
    </div>

    <div class="d-flex gap-2">
      <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
        {{ $t("operations.submit") }}
      </button>
      <button type="button" class="btn btn-outline-secondary" @click="emit('cancel')">
        {{ $t("common.cancel") }}
      </button>
    </div>
  </form>
</template>

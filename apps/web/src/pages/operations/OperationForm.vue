<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useI18n } from "vue-i18n";
import { apiClient } from "../../api/client";
import { useToast } from "../../composables/useToast";
import type { Account, Bank } from "../accounts/accounts.types";
import { currencySymbol, toDisplayAmount } from "./money";
import { operationSchema, type OperationForm } from "./operations.schemas";
import {
  categoryLabel,
  groupCategories,
  PAYMENT_METHODS,
  TRANSFER_PAYMENT_METHOD_IDS,
  type Category,
  type Operation,
} from "./operations.types";

const props = withDefaults(
  defineProps<{
    accountId: number;
    categories: Category[];
    accounts: Account[];
    banks?: Bank[];
    operation?: Operation | null;
  }>(),
  { banks: () => [], operation: null },
);
const emit = defineEmits<{ saved: []; savedAndNew: []; cancel: [] }>();

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

const { defineField, handleSubmit, errors, isSubmitting, resetForm } = useForm<OperationForm>({
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
const groupedCategories = computed(() => groupCategories(filteredCategories.value));
const filteredPaymentMethods = computed(() =>
  PAYMENT_METHODS.filter((pm) => pm.type === type.value),
);
// Choices: the member's other fully active accounts (account and bank
// neither closed nor deleted) sharing the source account's currency, plus
// — when editing an operation whose stored transfer account has since
// gone inactive — that stored account kept selectable so the pair can be
// preserved, retargeted, or unlinked.
const sourceCurrency = computed(
  () => props.accounts.find((a) => a.id === props.accountId)?.currency,
);
const bankById = computed(() => new Map(props.banks.map((b) => [b.id, b])));
function isFullyActiveAccount(a: Account): boolean {
  return !a.closed && !(bankById.value.get(a.bankId)?.closed ?? false);
}
const transferTargets = computed(() => {
  const eligible = props.accounts.filter(
    (a) =>
      a.id !== props.accountId && a.currency === sourceCurrency.value && isFullyActiveAccount(a),
  );
  const storedTargetId = props.operation?.transferAccountId;
  if (storedTargetId && !eligible.some((a) => a.id === storedTargetId)) {
    const stored = props.accounts.find((a) => a.id === storedTargetId);
    if (stored) eligible.push(stored);
  }
  return eligible;
});
const showTransferAccount = computed(() =>
  TRANSFER_PAYMENT_METHOD_IDS.includes(Number(paymentMethodId.value)),
);
const amountCurrencySymbol = computed(() =>
  sourceCurrency.value ? currencySymbol(sourceCurrency.value) : "",
);

// Switching type clears the category/payment-method choice only when it no
// longer matches the new type — a still-valid selection is preserved.
watch(type, () => {
  if (!filteredCategories.value.some((c) => c.id === categoryId.value)) {
    categoryId.value = undefined;
  }
  if (!filteredPaymentMethods.value.some((pm) => pm.id === paymentMethodId.value)) {
    paymentMethodId.value = undefined as unknown as number;
  }
});

interface ThirdPartySuggestion {
  thirdParty: string;
  categoryId: number | null;
}

const suggestions = ref<ThirdPartySuggestion[]>([]);
const amountInput = ref<HTMLInputElement | null>(null);
let debounceHandle: ReturnType<typeof setTimeout> | undefined;

// Native "change" (not "input") fires when a datalist suggestion is picked,
// as opposed to every keystroke while typing — selecting a suggestion
// moves focus to the next field.
function onThirdPartyChange() {
  const isSuggestion = suggestions.value.some((s) => s.thirdParty === thirdParty.value);
  if (isSuggestion) {
    nextTick(() => amountInput.value?.focus());
  }
}

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

async function submitForm(submitted: OperationForm): Promise<boolean> {
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
    return false;
  }

  toast(t("operations.saved"), "success");
  return true;
}

const onSubmit = handleSubmit(async (submitted) => {
  if (await submitForm(submitted)) {
    emit("saved");
  }
});

// Creation form only: saves and immediately returns to a fresh creation
// form for the same account, instead of closing.
const onSubmitAndNew = handleSubmit(async (submitted) => {
  if (await submitForm(submitted)) {
    resetForm({ values: initialValues() });
    emit("savedAndNew");
  }
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
          autofocus
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
        @change="onThirdPartyChange"
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
      <div class="input-group">
        <span class="input-group-text">{{ amountCurrencySymbol }}</span>
        <input
          id="operation-amount"
          ref="amountInput"
          v-model="amount"
          v-bind="amountAttrs"
          type="number"
          inputmode="decimal"
          step="0.01"
          class="form-control"
          :class="{ 'is-invalid': errors.amount }"
        />
      </div>
      <div v-if="errors.amount" class="invalid-feedback d-block">
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
        <template v-for="group in groupedCategories" :key="group.label ?? '_'">
          <template v-if="group.label === null">
            <option v-for="c in group.categories" :key="c.id" :value="c.id">
              {{ categoryLabel(c, props.categories) }}
            </option>
          </template>
          <optgroup v-else :label="group.label">
            <option v-for="c in group.categories" :key="c.id" :value="c.id">
              {{ categoryLabel(c, props.categories) }}
            </option>
          </optgroup>
        </template>
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
        <option value="">{{ $t("operations.externalAccount") }}</option>
        <option v-for="a in transferTargets" :key="a.id" :value="a.id">{{ a.name }}</option>
      </select>
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
      <button
        v-if="!props.operation"
        type="button"
        class="btn btn-outline-primary"
        :disabled="isSubmitting"
        @click="onSubmitAndNew"
      >
        {{ $t("operations.submitAndNew") }}
      </button>
      <button type="button" class="btn btn-outline-secondary" @click="emit('cancel')">
        {{ $t("common.cancel") }}
      </button>
    </div>
  </form>
</template>

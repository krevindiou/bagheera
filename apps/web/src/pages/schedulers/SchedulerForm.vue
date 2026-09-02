<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useI18n } from "vue-i18n";
import { apiClient } from "../../api/client";
import { useThirdPartyAutocomplete } from "../../composables/useThirdPartyAutocomplete";
import { useToast } from "../../composables/useToast";
import { useTransferTargets } from "../../composables/useTransferTargets";
import { useTypedReferenceData } from "../../composables/useTypedReferenceData";
import type { Account, Bank } from "../accounts/accounts.types";
import { toDisplayAmount } from "../operations/money";
import {
  categoryLabel,
  TRANSFER_PAYMENT_METHOD_IDS,
  type Category,
  type PaymentMethod,
} from "../operations/operations.types";
import { schedulerSchema, type SchedulerForm } from "./schedulers.schemas";
import type { Scheduler } from "./schedulers.types";

const props = withDefaults(
  defineProps<{
    accountId: number;
    categories: Category[];
    paymentMethods: PaymentMethod[];
    accounts: Account[];
    banks?: Bank[];
    scheduler?: Scheduler | null;
  }>(),
  { banks: () => [], scheduler: null },
);
const emit = defineEmits<{ saved: []; cancel: [] }>();

const { push: toast } = useToast();
const { t } = useI18n();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function initialValues(): SchedulerForm {
  const s = props.scheduler;
  if (!s) {
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
      limitDate: undefined,
      frequencyUnit: "month",
      frequencyValue: 1,
      active: true,
    };
  }
  return {
    type: s.debit !== null ? "debit" : "credit",
    thirdParty: s.thirdParty,
    amount: toDisplayAmount((s.debit ?? s.credit)!),
    categoryId: s.categoryId ?? undefined,
    paymentMethodId: s.paymentMethodId,
    transferAccountId: s.transferAccountId ?? undefined,
    valueDate: s.valueDate,
    notes: s.notes,
    reconciled: s.reconciled,
    limitDate: s.limitDate ?? undefined,
    frequencyUnit: s.frequencyUnit,
    frequencyValue: s.frequencyValue,
    active: s.active,
  };
}

const { defineField, handleSubmit, errors, isSubmitting } = useForm<SchedulerForm>({
  validationSchema: toTypedSchema(schedulerSchema),
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
const [limitDate, limitDateAttrs] = defineField("limitDate");
const [frequencyUnit, frequencyUnitAttrs] = defineField("frequencyUnit");
const [frequencyValue, frequencyValueAttrs] = defineField("frequencyValue");
const [active, activeAttrs] = defineField("active");

// Same field logic as the operation form and the search panel:
// category/payment-method choices only ever show options matching the
// selected debit/credit type; a still-valid selection survives a type
// switch.
const { groupedCategories, filteredPaymentMethods } = useTypedReferenceData(
  type,
  () => props.categories,
  () => props.paymentMethods,
  { categoryId, paymentMethodId },
);
const showTransferAccount = computed(() =>
  TRANSFER_PAYMENT_METHOD_IDS.includes(Number(paymentMethodId.value)),
);
// Same choices/rules as the operation form (spec 4.9/4.12).
const { transferTargets, amountCurrencySymbol } = useTransferTargets(
  () => props.accountId,
  () => props.accounts,
  () => props.banks,
  () => props.scheduler?.transferAccountId,
);

const amountInput = ref<HTMLInputElement | null>(null);
// Same third-party autocomplete as the operation form.
const { suggestions } = useThirdPartyAutocomplete(thirdParty, type, (matchedCategoryId) => {
  categoryId.value = matchedCategoryId;
});

// Native "change" (not "input") fires when a datalist suggestion is picked,
// as opposed to every keystroke while typing — selecting a suggestion
// moves focus to the next field.
function onThirdPartyChange() {
  const isSuggestion = suggestions.value.some((s) => s.thirdParty === thirdParty.value);
  if (isSuggestion) {
    nextTick(() => amountInput.value?.focus());
  }
}

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
    limitDate: submitted.limitDate,
    frequencyUnit: submitted.frequencyUnit,
    frequencyValue: submitted.frequencyValue,
    active: submitted.active,
  };

  const { error, response } = props.scheduler
    ? await apiClient.PATCH("/schedulers/{id}", {
        params: { path: { id: props.scheduler.id } },
        body,
      })
    : await apiClient.POST("/schedulers", { body });

  if (!response.ok) {
    toast(errorMessage(error) ?? t("schedulers.genericError"), "error");
    return;
  }

  toast(t(props.scheduler ? "schedulers.updated" : "schedulers.created"), "success");
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
      {{ $t(props.scheduler ? "schedulers.editTitle" : "schedulers.createTitle") }}
    </h2>

    <div class="mb-3">
      <div class="form-check form-check-inline">
        <input
          id="scheduler-type-debit"
          v-model="type"
          v-bind="typeAttrs"
          class="form-check-input"
          type="radio"
          value="debit"
          autofocus
        />
        <label class="form-check-label" for="scheduler-type-debit">{{
          $t("operations.debit")
        }}</label>
      </div>
      <div class="form-check form-check-inline">
        <input
          id="scheduler-type-credit"
          v-model="type"
          v-bind="typeAttrs"
          class="form-check-input"
          type="radio"
          value="credit"
        />
        <label class="form-check-label" for="scheduler-type-credit">{{
          $t("operations.credit")
        }}</label>
      </div>
    </div>

    <div class="mb-3 position-relative">
      <label class="form-label" for="scheduler-third-party">{{
        $t("operations.thirdParty")
      }}</label>
      <input
        id="scheduler-third-party"
        v-model="thirdParty"
        v-bind="thirdPartyAttrs"
        type="text"
        list="scheduler-third-party-suggestions"
        autocomplete="off"
        class="form-control"
        :class="{ 'is-invalid': errors.thirdParty }"
        @change="onThirdPartyChange"
      />
      <datalist id="scheduler-third-party-suggestions">
        <option v-for="s in suggestions" :key="s.thirdParty" :value="s.thirdParty" />
      </datalist>
      <div v-if="errors.thirdParty" class="invalid-feedback">
        {{ $t("auth.validation.required") }}
      </div>
    </div>

    <div class="mb-3">
      <label class="form-label" for="scheduler-amount">{{ $t("operations.amount") }}</label>
      <div class="input-group">
        <span class="input-group-text">{{ amountCurrencySymbol }}</span>
        <input
          id="scheduler-amount"
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
      <label class="form-label" for="scheduler-category">{{ $t("operations.category") }}</label>
      <select
        id="scheduler-category"
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
      <label class="form-label" for="scheduler-payment-method">{{
        $t("operations.paymentMethod")
      }}</label>
      <select
        id="scheduler-payment-method"
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
      <label class="form-label" for="scheduler-transfer-account">
        {{ $t("operations.transferAccount") }}
      </label>
      <select
        id="scheduler-transfer-account"
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
      <label class="form-label" for="scheduler-value-date">{{
        $t("schedulers.firstOccurrence")
      }}</label>
      <input
        id="scheduler-value-date"
        v-model="valueDate"
        v-bind="valueDateAttrs"
        type="date"
        class="form-control"
      />
    </div>

    <div class="row mb-3">
      <div class="col">
        <label class="form-label" for="scheduler-frequency-value">{{
          $t("schedulers.every")
        }}</label>
        <input
          id="scheduler-frequency-value"
          v-model="frequencyValue"
          v-bind="frequencyValueAttrs"
          type="number"
          min="1"
          step="1"
          class="form-control"
          :class="{ 'is-invalid': errors.frequencyValue }"
        />
        <div v-if="errors.frequencyValue" class="invalid-feedback">
          {{ $t("schedulers.validation.frequencyValue") }}
        </div>
      </div>
      <div class="col">
        <label class="form-label" for="scheduler-frequency-unit">{{
          $t("schedulers.frequencyUnit")
        }}</label>
        <select
          id="scheduler-frequency-unit"
          v-model="frequencyUnit"
          v-bind="frequencyUnitAttrs"
          class="form-select"
        >
          <option value="day">{{ $t("schedulers.units.day") }}</option>
          <option value="week">{{ $t("schedulers.units.week") }}</option>
          <option value="month">{{ $t("schedulers.units.month") }}</option>
          <option value="year">{{ $t("schedulers.units.year") }}</option>
        </select>
      </div>
    </div>

    <div class="mb-3">
      <label class="form-label" for="scheduler-limit-date">{{ $t("schedulers.limitDate") }}</label>
      <input
        id="scheduler-limit-date"
        v-model="limitDate"
        v-bind="limitDateAttrs"
        type="date"
        class="form-control"
      />
    </div>

    <div class="mb-3">
      <label class="form-label" for="scheduler-notes">{{ $t("operations.notes") }}</label>
      <textarea
        id="scheduler-notes"
        v-model="notes"
        v-bind="notesAttrs"
        class="form-control"
      ></textarea>
    </div>

    <div class="mb-3 form-check">
      <input
        id="scheduler-reconciled"
        v-model="reconciled"
        v-bind="reconciledAttrs"
        type="checkbox"
        class="form-check-input"
      />
      <label class="form-check-label" for="scheduler-reconciled">{{
        $t("operations.reconciled")
      }}</label>
    </div>

    <div class="mb-3 form-check">
      <input
        id="scheduler-active"
        v-model="active"
        v-bind="activeAttrs"
        type="checkbox"
        class="form-check-input"
      />
      <label class="form-check-label" for="scheduler-active">{{ $t("schedulers.active") }}</label>
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

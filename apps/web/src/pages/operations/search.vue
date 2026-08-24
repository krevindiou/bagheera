<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { PAYMENT_METHODS } from "./operations.types";
import type { AmountComparatorOperator, Category, SearchCriteria } from "./operations.types";

const props = defineProps<{ categories: Category[] }>();
const emit = defineEmits<{ submit: [SearchCriteria]; clear: [] }>();

const type = ref<"debit" | "credit">("debit");
const thirdParty = ref("");
const categoryIds = ref<number[]>([]);
const paymentMethodIds = ref<number[]>([]);
const amountOperator1 = ref<"" | AmountComparatorOperator>("");
const amountValue1 = ref<number | undefined>(undefined);
const amountOperator2 = ref<"" | AmountComparatorOperator>("");
const amountValue2 = ref<number | undefined>(undefined);
const dateFrom = ref("");
const dateTo = ref("");
const notes = ref("");
// Three-state, default "Reconciled & not reconciled" (no filter).
const reconciled = ref<"" | "true" | "false">("");

const AMOUNT_OPERATORS: AmountComparatorOperator[] = ["gt", "gte", "lt", "lte", "eq"];

// Spec 2.7: selecting the type rebuilds the category/payment-method choices
// to show only entries of that type (previous selection preserved when
// still valid).
const filteredCategories = computed(() => props.categories.filter((c) => c.type === type.value));
const filteredPaymentMethods = computed(() =>
  PAYMENT_METHODS.filter((pm) => pm.type === type.value),
);

function buildCriteria(): SearchCriteria {
  const amountComparators: SearchCriteria["amountComparators"] = [];
  if (amountOperator1.value && amountValue1.value !== undefined) {
    amountComparators.push({ operator: amountOperator1.value, value: amountValue1.value });
  }
  if (amountOperator2.value && amountValue2.value !== undefined) {
    amountComparators.push({ operator: amountOperator2.value, value: amountValue2.value });
  }
  return {
    type: type.value,
    thirdParty: thirdParty.value.trim() || undefined,
    categoryIds: categoryIds.value.length ? categoryIds.value : undefined,
    paymentMethodIds: paymentMethodIds.value.length ? paymentMethodIds.value : undefined,
    amountComparators: amountComparators.length ? amountComparators : undefined,
    dateFrom: dateFrom.value || undefined,
    dateTo: dateTo.value || undefined,
    notes: notes.value.trim() || undefined,
    reconciled: reconciled.value === "" ? undefined : reconciled.value === "true",
  };
}

watch(type, () => {
  categoryIds.value = categoryIds.value.filter((id) =>
    filteredCategories.value.some((c) => c.id === id),
  );
  paymentMethodIds.value = paymentMethodIds.value.filter((id) =>
    filteredPaymentMethods.value.some((pm) => pm.id === id),
  );
});

function onSubmit() {
  emit("submit", buildCriteria());
}

function reset() {
  type.value = "debit";
  thirdParty.value = "";
  categoryIds.value = [];
  paymentMethodIds.value = [];
  amountOperator1.value = "";
  amountValue1.value = undefined;
  amountOperator2.value = "";
  amountValue2.value = undefined;
  dateFrom.value = "";
  dateTo.value = "";
  notes.value = "";
  reconciled.value = "";
}

function onClear() {
  reset();
  emit("clear");
}
</script>

<template>
  <form data-testid="search-form" class="border rounded p-3 mb-3" @submit.prevent="onSubmit">
    <h2 class="h6">{{ $t("operations.search.title") }}</h2>

    <div class="mb-3">
      <div class="form-label">{{ $t("operations.search.type") }}</div>
      <div class="form-check form-check-inline">
        <input
          id="search-type-debit"
          v-model="type"
          class="form-check-input"
          type="radio"
          value="debit"
          autofocus
        />
        <label class="form-check-label" for="search-type-debit">{{ $t("operations.debit") }}</label>
      </div>
      <div class="form-check form-check-inline">
        <input
          id="search-type-credit"
          v-model="type"
          class="form-check-input"
          type="radio"
          value="credit"
        />
        <label class="form-check-label" for="search-type-credit">{{
          $t("operations.credit")
        }}</label>
      </div>
    </div>

    <div class="mb-3">
      <label class="form-label" for="search-third-party">{{ $t("operations.thirdParty") }}</label>
      <input
        id="search-third-party"
        v-model="thirdParty"
        type="text"
        maxlength="64"
        class="form-control"
      />
    </div>

    <div class="mb-3">
      <label class="form-label" for="search-categories">{{ $t("operations.category") }}</label>
      <select id="search-categories" v-model="categoryIds" multiple class="form-select">
        <option v-for="c in filteredCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </div>

    <div class="mb-3">
      <label class="form-label" for="search-payment-methods">{{
        $t("operations.paymentMethod")
      }}</label>
      <select id="search-payment-methods" v-model="paymentMethodIds" multiple class="form-select">
        <option v-for="pm in filteredPaymentMethods" :key="pm.id" :value="pm.id">{{ pm.name }}</option>
      </select>
    </div>

    <div class="row mb-3">
      <div class="col">
        <label class="form-label" for="search-amount-operator-1">{{
          $t("operations.search.amount")
        }}</label>
        <select id="search-amount-operator-1" v-model="amountOperator1" class="form-select">
          <option value="">{{ $t("operations.search.any") }}</option>
          <option v-for="op in AMOUNT_OPERATORS" :key="op" :value="op">
            {{ $t(`operations.search.operators.${op}`) }}
          </option>
        </select>
      </div>
      <div class="col">
        <input
          v-model.number="amountValue1"
          type="number"
          inputmode="decimal"
          step="0.01"
          class="form-control"
          :aria-label="$t('operations.search.amount')"
        />
      </div>
    </div>

    <div class="row mb-3">
      <div class="col">
        <select id="search-amount-operator-2" v-model="amountOperator2" class="form-select">
          <option value="">{{ $t("operations.search.any") }}</option>
          <option v-for="op in AMOUNT_OPERATORS" :key="op" :value="op">
            {{ $t(`operations.search.operators.${op}`) }}
          </option>
        </select>
      </div>
      <div class="col">
        <input
          v-model.number="amountValue2"
          type="number"
          inputmode="decimal"
          step="0.01"
          class="form-control"
          :aria-label="$t('operations.search.amount')"
        />
      </div>
    </div>

    <div class="row mb-3">
      <div class="col">
        <label class="form-label" for="search-date-from">{{
          $t("operations.search.dateFrom")
        }}</label>
        <input id="search-date-from" v-model="dateFrom" type="date" class="form-control" />
      </div>
      <div class="col">
        <label class="form-label" for="search-date-to">{{ $t("operations.search.dateTo") }}</label>
        <input id="search-date-to" v-model="dateTo" type="date" class="form-control" />
      </div>
    </div>

    <div class="mb-3">
      <label class="form-label" for="search-notes">{{ $t("operations.notes") }}</label>
      <input
        id="search-notes"
        v-model="notes"
        type="text"
        maxlength="128"
        class="form-control"
      />
    </div>

    <div class="mb-3">
      <label class="form-label" for="search-reconciled">{{ $t("operations.reconciled") }}</label>
      <select id="search-reconciled" v-model="reconciled" class="form-select">
        <option value="">{{ $t("operations.search.both") }}</option>
        <option value="true">{{ $t("operations.search.yes") }}</option>
        <option value="false">{{ $t("operations.search.no") }}</option>
      </select>
    </div>

    <div class="d-flex gap-2">
      <button type="submit" class="btn btn-primary">{{ $t("operations.search.submit") }}</button>
      <button type="button" class="btn btn-outline-secondary" @click="onClear">
        {{ $t("operations.search.clear") }}
      </button>
    </div>
  </form>
</template>

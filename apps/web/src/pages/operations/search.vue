<script setup lang="ts">
import { AMOUNT_CEILING } from '@bagheera/money';
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import FormField from '../../components/FormField.vue';
import CategorySelect from '../../components/CategorySelect.vue';
import FormDrawer from '../../components/FormDrawer.vue';
import { useTypedReferenceData } from '../../composables/useTypedReferenceData';
import type {
  AmountComparatorOperator,
  Category,
  PaymentMethod,
  SearchCriteria,
} from './operations.types';

const props = defineProps<{
  categories: Category[];
  paymentMethods: PaymentMethod[];
  initialCriteria?: SearchCriteria;
}>();
const emit = defineEmits<{ submit: [SearchCriteria]; clear: []; cancel: [] }>();

const { locale } = useI18n();

const type = ref<'debit' | 'credit'>('debit');
const thirdParty = ref('');
const categoryIds = ref<string[]>([]);
const paymentMethodIds = ref<string[]>([]);
const amountOperator1 = ref<'' | AmountComparatorOperator>('');
const amountValue1 = ref<number | undefined>(undefined);
const amountOperator2 = ref<'' | AmountComparatorOperator>('');
const amountValue2 = ref<number | undefined>(undefined);
const dateFrom = ref('');
const dateTo = ref('');
const notes = ref('');
// Three-state, default "Reconciled & not reconciled" (no filter).
const reconciled = ref<'' | 'true' | 'false'>('');

// Hydrate the panel's fields from a remembered search recalled by the
// parent (e.g. on mount/navigate-back), so a docked-open panel reflects
// the criteria that are actually applied.
function hydrate(criteria: SearchCriteria | undefined) {
  if (!criteria) return;
  type.value = criteria.type ?? 'debit';
  thirdParty.value = criteria.thirdParty ?? '';
  categoryIds.value = criteria.categoryIds ?? [];
  paymentMethodIds.value = criteria.paymentMethodIds ?? [];
  amountOperator1.value = criteria.amountComparators?.[0]?.operator ?? '';
  amountValue1.value = criteria.amountComparators?.[0]?.value;
  amountOperator2.value = criteria.amountComparators?.[1]?.operator ?? '';
  amountValue2.value = criteria.amountComparators?.[1]?.value;
  dateFrom.value = criteria.dateFrom ?? '';
  dateTo.value = criteria.dateTo ?? '';
  notes.value = criteria.notes ?? '';
  reconciled.value =
    criteria.reconciled === undefined ? '' : criteria.reconciled ? 'true' : 'false';
}

watch(() => props.initialCriteria, hydrate, { immediate: true });

const AMOUNT_OPERATORS: AmountComparatorOperator[] = ['gt', 'gte', 'lt', 'lte', 'eq'];

// Selecting the type rebuilds the category/payment-method choices to
// show only entries of that type (previous selection preserved when
// still valid) — same field logic as OperationForm/SchedulerForm.
const { filteredCategories, groupedCategories, filteredPaymentMethods } = useTypedReferenceData(
  type,
  () => props.categories,
  () => props.paymentMethods,
);

function buildCriteria(): SearchCriteria {
  const amountComparators: SearchCriteria['amountComparators'] = [];
  // The second row is ignored unless the first has a value.
  if (amountOperator1.value && amountValue1.value !== undefined) {
    amountComparators.push({ operator: amountOperator1.value, value: amountValue1.value });
    if (amountOperator2.value && amountValue2.value !== undefined) {
      amountComparators.push({ operator: amountOperator2.value, value: amountValue2.value });
    }
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
    reconciled: reconciled.value === '' ? undefined : reconciled.value === 'true',
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
  emit('submit', buildCriteria());
}

function reset() {
  type.value = 'debit';
  thirdParty.value = '';
  categoryIds.value = [];
  paymentMethodIds.value = [];
  amountOperator1.value = '';
  amountValue1.value = undefined;
  amountOperator2.value = '';
  amountValue2.value = undefined;
  dateFrom.value = '';
  dateTo.value = '';
  notes.value = '';
  reconciled.value = '';
}

function onClear() {
  reset();
  emit('clear');
}
</script>

<template>
  <FormDrawer
    :title="$t('operations.search.title')"
    data-testid="search-form"
    @submit="onSubmit"
    @close="emit('cancel')"
  >
    <div class="mb-3">
      <div class="form-label">{{ $t('operations.search.type') }}</div>
      <div class="form-check form-check-inline">
        <input
          id="search-type-debit"
          v-model="type"
          v-autofocus
          class="form-check-input"
          type="radio"
          value="debit"
        />
        <label class="form-check-label" for="search-type-debit">{{ $t('operations.debit') }}</label>
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
          $t('operations.credit')
        }}</label>
      </div>
    </div>

    <FormField :label="$t('operations.thirdParty')" for="search-third-party">
      <input
        id="search-third-party"
        v-model="thirdParty"
        type="text"
        maxlength="64"
        class="form-control"
      />
    </FormField>

    <FormField :label="$t('operations.category')" for="search-categories">
      <CategorySelect
        id="search-categories"
        v-model="categoryIds"
        multiple
        :groups="groupedCategories"
        :all-categories="props.categories"
      />
    </FormField>

    <FormField :label="$t('operations.paymentMethod')" for="search-payment-methods">
      <select id="search-payment-methods" v-model="paymentMethodIds" multiple class="form-select">
        <option v-for="pm in filteredPaymentMethods" :key="pm.id" :value="pm.id">
          {{ pm.name }}
        </option>
      </select>
    </FormField>

    <div class="row mb-3 align-items-end">
      <div class="col">
        <label class="form-label" for="search-amount-operator-1">{{
          $t('operations.search.amount')
        }}</label>
        <select id="search-amount-operator-1" v-model="amountOperator1" class="form-select">
          <option value="">{{ $t('operations.search.any') }}</option>
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
          :max="AMOUNT_CEILING"
          class="form-control"
          :aria-label="$t('operations.search.amount')"
        />
      </div>
    </div>

    <div class="row mb-3">
      <div class="col">
        <select id="search-amount-operator-2" v-model="amountOperator2" class="form-select">
          <option value="">{{ $t('operations.search.any') }}</option>
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
          :max="AMOUNT_CEILING"
          class="form-control"
          :aria-label="$t('operations.search.amount')"
        />
      </div>
    </div>

    <div class="row">
      <FormField class="col" :label="$t('operations.search.dateFrom')" for="search-date-from">
        <input
          id="search-date-from"
          v-model="dateFrom"
          type="date"
          :lang="locale"
          class="form-control"
        />
      </FormField>
      <FormField class="col" :label="$t('operations.search.dateTo')" for="search-date-to">
        <input
          id="search-date-to"
          v-model="dateTo"
          type="date"
          :lang="locale"
          class="form-control"
        />
      </FormField>
    </div>

    <FormField :label="$t('operations.notes')" for="search-notes">
      <input id="search-notes" v-model="notes" type="text" maxlength="128" class="form-control" />
    </FormField>

    <FormField :label="$t('operations.reconciled')" for="search-reconciled">
      <select id="search-reconciled" v-model="reconciled" class="form-select">
        <option value="">{{ $t('operations.search.both') }}</option>
        <option value="true">{{ $t('operations.search.yes') }}</option>
        <option value="false">{{ $t('operations.search.no') }}</option>
      </select>
    </FormField>

    <template #actions>
      <button type="submit" class="btn btn-primary">{{ $t('operations.search.submit') }}</button>
      <button type="button" class="btn btn-outline-secondary" @click="onClear">
        {{ $t('operations.search.clear') }}
      </button>
    </template>
  </FormDrawer>
</template>

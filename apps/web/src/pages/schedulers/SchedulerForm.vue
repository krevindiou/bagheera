<script setup lang="ts">
import { AMOUNT_CEILING } from '@bagheera/money';
import { computed, nextTick, ref } from 'vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { useI18n } from 'vue-i18n';
import { apiClient } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';
import FormField from '../../components/FormField.vue';
import CategorySelect from '../../components/CategorySelect.vue';
import FormDrawer from '../../components/FormDrawer.vue';
import { useThirdPartyAutocomplete } from '../../composables/useThirdPartyAutocomplete';
import { useToast } from '../../composables/useToast';
import { useTransferTargets } from '../../composables/useTransferTargets';
import { useTypedReferenceData } from '../../composables/useTypedReferenceData';
import type { Account, Bank } from '../accounts/accounts.types';
import { toDisplayAmount } from '../operations/money';
import {
  TRANSFER_PAYMENT_METHOD_IDS,
  type Category,
  type PaymentMethod,
} from '../operations/operations.types';
import { schedulerSchema, type SchedulerForm } from './schedulers.schemas';
import type { Scheduler } from './schedulers.types';

const props = withDefaults(
  defineProps<{
    accountId: string;
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
const { t, locale } = useI18n();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function initialValues(): SchedulerForm {
  const s = props.scheduler;
  if (!s) {
    return {
      type: 'debit',
      thirdParty: '',
      amount: undefined as unknown as number,
      categoryId: undefined,
      paymentMethodId: undefined as unknown as string,
      transferAccountId: undefined,
      valueDate: today(),
      notes: '',
      reconciled: false,
      limitDate: undefined,
      frequencyUnit: 'month',
      frequencyValue: 1,
      active: true,
    };
  }
  return {
    type: s.debit !== null ? 'debit' : 'credit',
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
const [type, typeAttrs] = defineField('type');
const [thirdParty, thirdPartyAttrs] = defineField('thirdParty');
const [amount, amountAttrs] = defineField('amount');
const [categoryId, categoryIdAttrs] = defineField('categoryId');
const [paymentMethodId, paymentMethodIdAttrs] = defineField('paymentMethodId');
const [transferAccountId, transferAccountIdAttrs] = defineField('transferAccountId');
const [valueDate, valueDateAttrs] = defineField('valueDate');
const [notes, notesAttrs] = defineField('notes');
const [reconciled, reconciledAttrs] = defineField('reconciled');
const [limitDate, limitDateAttrs] = defineField('limitDate');
const [frequencyUnit, frequencyUnitAttrs] = defineField('frequencyUnit');
const [frequencyValue, frequencyValueAttrs] = defineField('frequencyValue');
const [active, activeAttrs] = defineField('active');

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
  TRANSFER_PAYMENT_METHOD_IDS.includes(paymentMethodId.value),
);
// errors.amount fires for two different reasons — zero/negative, or over
// AMOUNT_CEILING — that deserve different copy; decided from the actual
// value rather than parsed out of zod's own issue, which the template
// never inspects otherwise. Same as OperationForm.vue's amountErrorKey.
const amountErrorKey = computed(() =>
  Number(amount.value) > AMOUNT_CEILING
    ? 'operations.validation.amountTooHigh'
    : 'operations.validation.amount',
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
    ? await apiClient.PATCH('/schedulers/{id}', {
        params: { path: { id: props.scheduler.id } },
        body,
      })
    : await apiClient.POST('/schedulers', { body });

  if (!response.ok) {
    toast(errorMessage(error) ?? t('schedulers.genericError'), 'error');
    return;
  }

  toast(t(props.scheduler ? 'schedulers.updated' : 'schedulers.created'), 'success');
  emit('saved');
});
</script>

<template>
  <FormDrawer
    :title="$t(props.scheduler ? 'schedulers.editTitle' : 'schedulers.createTitle')"
    novalidate
    @submit="onSubmit"
    @close="emit('cancel')"
  >
    <div class="mb-3">
      <div class="form-check form-check-inline">
        <input
          id="scheduler-type-debit"
          v-model="type"
          v-bind="typeAttrs"
          v-autofocus
          class="form-check-input"
          type="radio"
          value="debit"
        />
        <label class="form-check-label" for="scheduler-type-debit">{{
          $t('operations.debit')
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
          $t('operations.credit')
        }}</label>
      </div>
    </div>

    <FormField
      class="position-relative"
      :label="$t('operations.thirdParty')"
      for="scheduler-third-party"
      :error="errors.thirdParty && $t('auth.validation.required')"
    >
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
    </FormField>

    <FormField
      :label="$t('operations.amount')"
      for="scheduler-amount"
      :error="errors.amount && $t(amountErrorKey)"
    >
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
    </FormField>

    <div class="d-flex gap-3">
      <FormField class="flex-grow-1" :label="$t('operations.category')" for="scheduler-category">
        <CategorySelect
          id="scheduler-category"
          v-model="categoryId"
          v-bind="categoryIdAttrs"
          :groups="groupedCategories"
          :all-categories="props.categories"
          :empty-label="$t('operations.noCategory')"
        />
      </FormField>

      <FormField
        class="flex-grow-1"
        :label="$t('operations.paymentMethod')"
        for="scheduler-payment-method"
        :error="errors.paymentMethodId && $t('auth.validation.required')"
      >
        <select
          id="scheduler-payment-method"
          v-model="paymentMethodId"
          v-bind="paymentMethodIdAttrs"
          class="form-select"
          :class="{ 'is-invalid': errors.paymentMethodId }"
        >
          <option value="">{{ $t('operations.choosePaymentMethod') }}</option>
          <option v-for="pm in filteredPaymentMethods" :key="pm.id" :value="pm.id">
            {{ pm.name }}
          </option>
        </select>
      </FormField>
    </div>

    <FormField
      v-if="showTransferAccount"
      class="transfer-accent"
      :label="$t('operations.transferAccount')"
      for="scheduler-transfer-account"
      :error="errors.transferAccountId && $t('auth.validation.required')"
    >
      <select
        id="scheduler-transfer-account"
        v-model="transferAccountId"
        v-bind="transferAccountIdAttrs"
        class="form-select"
        :class="{ 'is-invalid': errors.transferAccountId }"
      >
        <option value="">{{ $t('operations.chooseTransferAccount') }}</option>
        <option v-for="a in transferTargets" :key="a.id" :value="a.id">{{ a.name }}</option>
      </select>
    </FormField>

    <FormField :label="$t('schedulers.firstOccurrence')" for="scheduler-value-date">
      <input
        id="scheduler-value-date"
        v-model="valueDate"
        v-bind="valueDateAttrs"
        type="date"
        :lang="locale"
        class="form-control"
      />
    </FormField>

    <div class="row">
      <FormField
        class="col"
        :label="$t('schedulers.every')"
        for="scheduler-frequency-value"
        :error="errors.frequencyValue && $t('schedulers.validation.frequencyValue')"
      >
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
      </FormField>
      <FormField class="col" :label="$t('schedulers.frequencyUnit')" for="scheduler-frequency-unit">
        <select
          id="scheduler-frequency-unit"
          v-model="frequencyUnit"
          v-bind="frequencyUnitAttrs"
          class="form-select"
        >
          <option value="day">{{ $t('schedulers.units.day') }}</option>
          <option value="week">{{ $t('schedulers.units.week') }}</option>
          <option value="month">{{ $t('schedulers.units.month') }}</option>
          <option value="year">{{ $t('schedulers.units.year') }}</option>
        </select>
      </FormField>
    </div>

    <FormField :label="$t('schedulers.limitDate')" for="scheduler-limit-date">
      <input
        id="scheduler-limit-date"
        v-model="limitDate"
        v-bind="limitDateAttrs"
        type="date"
        :lang="locale"
        class="form-control"
      />
    </FormField>

    <FormField :label="$t('operations.notes')" for="scheduler-notes">
      <textarea
        id="scheduler-notes"
        v-model="notes"
        v-bind="notesAttrs"
        class="form-control"
      ></textarea>
    </FormField>

    <div class="mb-3 form-check">
      <input
        id="scheduler-reconciled"
        v-model="reconciled"
        v-bind="reconciledAttrs"
        type="checkbox"
        class="form-check-input"
      />
      <label class="form-check-label" for="scheduler-reconciled">{{
        $t('operations.reconciled')
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
      <label class="form-check-label" for="scheduler-active">{{ $t('schedulers.active') }}</label>
    </div>

    <template #actions>
      <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
        {{ $t('operations.submit') }}
      </button>
    </template>
  </FormDrawer>
</template>

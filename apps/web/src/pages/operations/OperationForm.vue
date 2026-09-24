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
import { toDisplayAmount } from './money';
import { operationSchema, type OperationForm } from './operations.schemas';
import {
  TRANSFER_PAYMENT_METHOD_IDS,
  type Category,
  type Operation,
  type PaymentMethod,
} from './operations.types';

const props = withDefaults(
  defineProps<{
    accountId: string;
    categories: Category[];
    paymentMethods: PaymentMethod[];
    accounts: Account[];
    banks?: Bank[];
    operation?: Operation | null;
  }>(),
  { banks: () => [], operation: null },
);
const emit = defineEmits<{ saved: []; savedAndNew: []; cancel: [] }>();

const { push: toast } = useToast();
const { t, locale } = useI18n();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function initialValues(): OperationForm {
  const op = props.operation;
  if (!op) {
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
    };
  }
  return {
    type: op.debit !== null ? 'debit' : 'credit',
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
const [type, typeAttrs] = defineField('type');
const [thirdParty, thirdPartyAttrs] = defineField('thirdParty');
const [amount, amountAttrs] = defineField('amount');
const [categoryId, categoryIdAttrs] = defineField('categoryId');
const [paymentMethodId, paymentMethodIdAttrs] = defineField('paymentMethodId');
const [transferAccountId, transferAccountIdAttrs] = defineField('transferAccountId');
const [valueDate, valueDateAttrs] = defineField('valueDate');
const [notes, notesAttrs] = defineField('notes');
const [reconciled, reconciledAttrs] = defineField('reconciled');

// Same field logic as the search panel: category/payment-method choices
// only ever show options matching the selected debit/credit type; a
// still-valid category/payment-method selection survives a type switch.
const { groupedCategories, filteredPaymentMethods } = useTypedReferenceData(
  type,
  () => props.categories,
  () => props.paymentMethods,
  { categoryId, paymentMethodId },
);
const { transferTargets, amountCurrencySymbol } = useTransferTargets(
  () => props.accountId,
  () => props.accounts,
  () => props.banks,
  () => props.operation?.transferAccountId,
);
const showTransferAccount = computed(() =>
  TRANSFER_PAYMENT_METHOD_IDS.includes(paymentMethodId.value),
);

// errors.amount fires for two different reasons — zero/negative, or over
// AMOUNT_CEILING — that deserve different copy; decided from the actual
// value rather than parsed out of zod's own issue, which the template
// never inspects otherwise.
const amountErrorKey = computed(() =>
  Number(amount.value) > AMOUNT_CEILING
    ? 'operations.validation.amountTooHigh'
    : 'operations.validation.amount',
);

const amountInput = ref<HTMLInputElement | null>(null);
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
    ? await apiClient.PATCH('/operations/{id}', {
        params: { path: { id: props.operation.id } },
        body,
      })
    : await apiClient.POST('/operations', { body });

  if (!response.ok) {
    toast(errorMessage(error) ?? t('operations.genericError'), 'error');
    return false;
  }

  toast(t('operations.saved'), 'success');
  return true;
}

const onSubmit = handleSubmit(async (submitted) => {
  if (await submitForm(submitted)) {
    emit('saved');
  }
});

// Creation form only: saves and immediately returns to a fresh creation
// form for the same account, instead of closing.
const onSubmitAndNew = handleSubmit(async (submitted) => {
  if (await submitForm(submitted)) {
    resetForm({ values: initialValues() });
    emit('savedAndNew');
  }
});
</script>

<template>
  <FormDrawer
    :title="$t(props.operation ? 'operations.editTitle' : 'operations.createTitle')"
    novalidate
    @submit="onSubmit"
    @close="emit('cancel')"
  >
    <div class="mb-3">
      <div class="form-check form-check-inline">
        <input
          id="operation-type-debit"
          v-model="type"
          v-bind="typeAttrs"
          v-autofocus
          class="form-check-input"
          type="radio"
          value="debit"
        />
        <label class="form-check-label" for="operation-type-debit">{{
          $t('operations.debit')
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
          $t('operations.credit')
        }}</label>
      </div>
    </div>

    <FormField
      class="position-relative"
      :label="$t('operations.thirdParty')"
      for="operation-third-party"
      :error="errors.thirdParty && $t('auth.validation.required')"
    >
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
    </FormField>

    <FormField
      :label="$t('operations.amount')"
      for="operation-amount"
      :error="errors.amount && $t(amountErrorKey)"
    >
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
    </FormField>

    <div class="d-flex gap-3">
      <FormField class="flex-grow-1" :label="$t('operations.category')" for="operation-category">
        <CategorySelect
          id="operation-category"
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
        for="operation-payment-method"
        :error="errors.paymentMethodId && $t('auth.validation.required')"
      >
        <select
          id="operation-payment-method"
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
      for="operation-transfer-account"
    >
      <select
        id="operation-transfer-account"
        v-model="transferAccountId"
        v-bind="transferAccountIdAttrs"
        class="form-select"
        :class="{ 'is-invalid': errors.transferAccountId }"
      >
        <option value="">{{ $t('operations.externalAccount') }}</option>
        <option v-for="a in transferTargets" :key="a.id" :value="a.id">{{ a.name }}</option>
      </select>
    </FormField>

    <FormField :label="$t('operations.valueDate')" for="operation-value-date">
      <input
        id="operation-value-date"
        v-model="valueDate"
        v-bind="valueDateAttrs"
        type="date"
        :lang="locale"
        class="form-control"
      />
    </FormField>

    <FormField :label="$t('operations.notes')" for="operation-notes">
      <textarea
        id="operation-notes"
        v-model="notes"
        v-bind="notesAttrs"
        class="form-control"
      ></textarea>
    </FormField>

    <div class="mb-3 form-check">
      <input
        id="operation-reconciled"
        v-model="reconciled"
        v-bind="reconciledAttrs"
        type="checkbox"
        class="form-check-input"
      />
      <label class="form-check-label" for="operation-reconciled">{{
        $t('operations.reconciled')
      }}</label>
    </div>

    <template #actions>
      <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
        {{ $t('operations.submit') }}
      </button>
      <button
        v-if="!props.operation"
        type="button"
        class="btn btn-outline-primary"
        :disabled="isSubmitting"
        @click="onSubmitAndNew"
      >
        {{ $t('operations.submitAndNew') }}
      </button>
    </template>
  </FormDrawer>
</template>

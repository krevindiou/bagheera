<script setup lang="ts">
import { AMOUNT_CEILING } from '@bagheera/money';
import { computed, nextTick, ref } from 'vue';
import { useField } from 'vee-validate';
import { useI18n } from 'vue-i18n';
import CategorySelect from '../../components/CategorySelect.vue';
import EntryTypeRadio from '../../components/EntryTypeRadio.vue';
import FormField from '../../components/FormField.vue';
import MoneyInput from '../../components/MoneyInput.vue';
import { useThirdPartyAutocomplete } from '../../composables/useThirdPartyAutocomplete';
import { useTransferTargets } from '../../composables/useTransferTargets';
import { useTypedReferenceData } from '../../composables/useTypedReferenceData';
import type { Account, Bank } from '../accounts/accounts.types';
import { referenceName } from '../../i18n/referenceNames';
import { TRANSFER_PAYMENT_METHOD_IDS, type Category, type PaymentMethod } from './operations.types';

// The fields an operation and a scheduler have in common — debit/credit,
// third party, amount, category, payment method, transfer account, value
// date, notes, reconciled — bound by name to the enclosing form's
// vee-validate context (the parent's `useForm`, reached by injection), so
// each form keeps only its own submit logic and extra fields. `idPrefix`
// builds every input id (`<prefix>-amount`, …). The `after-value-date`
// slot sits right under the value date, and `end` after the last field.
const props = defineProps<{
  idPrefix: string;
  accountId: string;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  accounts: Account[];
  banks: Bank[];
  // The row's stored transfer account when editing, kept selectable even
  // if it has since gone inactive.
  storedTransferAccountId?: string | null;
  valueDateLabel: string;
  transferPlaceholder: string;
}>();

const { locale } = useI18n();

const { value: type } = useField<'debit' | 'credit'>('type');
const { value: thirdParty, errorMessage: thirdPartyError } = useField<string | undefined>(
  'thirdParty',
);
const { value: amount, errorMessage: amountError } = useField<number | string | undefined>(
  'amount',
);
const { value: categoryId } = useField<string | undefined>('categoryId');
const { value: paymentMethodId, errorMessage: paymentMethodError } =
  useField<string>('paymentMethodId');
const { value: transferAccountId, errorMessage: transferAccountError } = useField<
  string | undefined
>('transferAccountId');
const { value: valueDate } = useField<string>('valueDate');
const { value: notes } = useField<string | undefined>('notes');
const { value: reconciled } = useField<boolean | undefined>('reconciled');

// Category/payment-method choices only ever show options matching the
// selected debit/credit type; a still-valid selection survives a type
// switch.
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
  () => props.storedTransferAccountId,
);
const showTransferAccount = computed(() =>
  TRANSFER_PAYMENT_METHOD_IDS.includes(paymentMethodId.value),
);

// An amount error fires for two different reasons — zero/negative, or over
// AMOUNT_CEILING — that deserve different copy; decided from the actual
// value rather than parsed out of zod's own issue.
const amountErrorKey = computed(() =>
  Number(amount.value) > AMOUNT_CEILING
    ? 'operations.validation.amountTooHigh'
    : 'operations.validation.amount',
);

const amountInput = ref<InstanceType<typeof MoneyInput> | null>(null);
const { suggestions } = useThirdPartyAutocomplete(thirdParty, type, (matchedCategoryId) => {
  categoryId.value = matchedCategoryId;
});

// Native "change" (not "input") fires when a datalist suggestion is picked,
// as opposed to every keystroke while typing — selecting a suggestion
// moves focus to the next field.
function onThirdPartyChange() {
  const isSuggestion = suggestions.value.some((s) => s.thirdParty === thirdParty.value);
  if (isSuggestion) {
    void nextTick(() => amountInput.value?.focus());
  }
}
</script>

<template>
  <EntryTypeRadio v-model="type" :id-prefix="`${idPrefix}-type`" />

  <FormField
    class="position-relative"
    :label="$t('operations.thirdParty')"
    :for="`${idPrefix}-third-party`"
    :error="thirdPartyError && $t('auth.validation.required')"
  >
    <input
      :id="`${idPrefix}-third-party`"
      v-model="thirdParty"
      type="text"
      :list="`${idPrefix}-third-party-suggestions`"
      autocomplete="off"
      class="form-control"
      :class="{ 'is-invalid': thirdPartyError }"
      @change="onThirdPartyChange"
    />
    <datalist :id="`${idPrefix}-third-party-suggestions`">
      <option v-for="s in suggestions" :key="s.thirdParty" :value="s.thirdParty" />
    </datalist>
  </FormField>

  <FormField
    :label="$t('operations.amount')"
    :for="`${idPrefix}-amount`"
    :error="amountError && $t(amountErrorKey)"
  >
    <MoneyInput
      :id="`${idPrefix}-amount`"
      ref="amountInput"
      v-model="amount"
      :symbol="amountCurrencySymbol"
      :invalid="!!amountError"
    />
  </FormField>

  <div class="d-flex gap-3">
    <FormField class="flex-grow-1" :label="$t('operations.category')" :for="`${idPrefix}-category`">
      <CategorySelect
        :id="`${idPrefix}-category`"
        v-model="categoryId"
        :groups="groupedCategories"
        :all-categories="categories"
        :empty-label="$t('operations.noCategory')"
      />
    </FormField>

    <FormField
      class="flex-grow-1"
      :label="$t('operations.paymentMethod')"
      :for="`${idPrefix}-payment-method`"
      :error="paymentMethodError && $t('auth.validation.required')"
    >
      <select
        :id="`${idPrefix}-payment-method`"
        v-model="paymentMethodId"
        class="form-select"
        :class="{ 'is-invalid': paymentMethodError }"
      >
        <option value="">{{ $t('operations.choosePaymentMethod') }}</option>
        <option v-for="pm in filteredPaymentMethods" :key="pm.id" :value="pm.id">
          {{ referenceName(pm.name) }}
        </option>
      </select>
    </FormField>
  </div>

  <FormField
    v-if="showTransferAccount"
    class="transfer-accent"
    :label="$t('operations.transferAccount')"
    :for="`${idPrefix}-transfer-account`"
    :error="transferAccountError && $t('auth.validation.required')"
  >
    <select
      :id="`${idPrefix}-transfer-account`"
      v-model="transferAccountId"
      class="form-select"
      :class="{ 'is-invalid': transferAccountError }"
    >
      <option value="">{{ transferPlaceholder }}</option>
      <option v-for="a in transferTargets" :key="a.id" :value="a.id">{{ a.name }}</option>
    </select>
  </FormField>

  <FormField :label="valueDateLabel" :for="`${idPrefix}-value-date`">
    <input
      :id="`${idPrefix}-value-date`"
      v-model="valueDate"
      type="date"
      :lang="locale"
      class="form-control"
    />
  </FormField>

  <slot name="after-value-date" />

  <FormField :label="$t('operations.notes')" :for="`${idPrefix}-notes`">
    <textarea :id="`${idPrefix}-notes`" v-model="notes" class="form-control"></textarea>
  </FormField>

  <div class="mb-3 form-check">
    <input
      :id="`${idPrefix}-reconciled`"
      v-model="reconciled"
      type="checkbox"
      class="form-check-input"
    />
    <label class="form-check-label" :for="`${idPrefix}-reconciled`">{{
      $t('operations.reconciled')
    }}</label>
  </div>

  <slot name="end" />
</template>

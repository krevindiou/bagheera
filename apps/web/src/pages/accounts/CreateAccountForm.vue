<script setup lang="ts">
import { computed } from 'vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { useI18n } from 'vue-i18n';
import { apiClient } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';
import type { components } from '../../api/schema';
import FormField from '../../components/FormField.vue';
import FormDrawer from '../../components/FormDrawer.vue';
import { useToast } from '../../composables/useToast';
import { getCurrencyOptions, getGuessedCurrency } from '../../composables/useCurrencyOptions';
import { currencySymbol } from '../operations/money';
import { createAccountSchema, editAccountSchema, type CreateAccountForm } from './accounts.schemas';
import type { Account, Bank } from './accounts.types';

// The API narrows currency to an ISO 4217 enum; the form only validates a
// 3-letter code (see accounts.schemas.ts), so the value is cast at the API
// boundary rather than widening the form's own type.
type CurrencyCode = components['schemas']['CreateAccountDto']['currency'];

// Account creation, reached after the bank-choice step, pre-scoped to the
// chosen/created bank (the bank field stays an editable dropdown of the
// member's active banks). Editing reuses this same form: same fields, but
// bank and currency are shown read-only and there's no initial-balance
// field.
const props = defineProps<{
  banks: Bank[];
  bankId?: string;
  mode?: 'create' | 'edit';
  account?: Account;
}>();
const emit = defineEmits<{ created: [accountId: string]; updated: []; cancel: [] }>();

const { push: toast } = useToast();
const { t } = useI18n();
const currencyOptions = getCurrencyOptions();

const isEdit = computed(() => props.mode === 'edit');
const schema = computed(() => (isEdit.value ? editAccountSchema : createAccountSchema));
const selectedBankName = computed(
  () => props.banks.find((bank) => bank.id === props.account?.bankId)?.name ?? '',
);
const selectedCurrencyLabel = computed(() => {
  const code = props.account?.currency;
  const option = currencyOptions.find((o) => o.code === code);
  return option ? `${option.code} — ${option.name}` : (code ?? '');
});

const { defineField, handleSubmit, errors, isSubmitting } = useForm<CreateAccountForm>({
  validationSchema: toTypedSchema(schema.value),
  initialValues: {
    bankId: props.account?.bankId ?? props.bankId ?? '',
    name: props.account?.name ?? '',
    currency: props.account?.currency ?? getGuessedCurrency(currencyOptions),
  },
});
const [selectedBankId, bankIdAttrs] = defineField('bankId');
const [name, nameAttrs] = defineField('name');
const [currency, currencyAttrs] = defineField('currency');
const [initialBalance, initialBalanceAttrs] = defineField('initialBalance');
const initialBalanceCurrencySymbol = computed(() =>
  currency.value ? currencySymbol(currency.value) : '',
);

const onSubmit = handleSubmit(async (values) => {
  if (isEdit.value && props.account) {
    const { error, response } = await apiClient.PATCH('/accounts/{id}', {
      params: { path: { id: props.account.id } },
      body: {
        name: values.name,
        bankId: props.account.bankId,
        currency: props.account.currency as CurrencyCode,
      },
    });
    if (!response.ok) {
      toast(errorMessage(error) ?? t('accounts.genericError'), 'error');
      return;
    }
    toast(t('accounts.accountSaved'), 'success');
    emit('updated');
    return;
  }

  const { data, error, response } = await apiClient.POST('/accounts', {
    body: {
      bankId: values.bankId,
      name: values.name,
      currency: values.currency.toUpperCase() as CurrencyCode,
      initialBalance: values.initialBalance,
    },
  });
  if (!response.ok) {
    toast(errorMessage(error) ?? t('accounts.genericError'), 'error');
    return;
  }

  toast(t('accounts.accountSaved'), 'success');
  const created = data as unknown as { account: { id: string } };
  emit('created', created.account.id);
});
</script>

<template>
  <FormDrawer
    :title="isEdit ? $t('accounts.editTitle') : $t('accounts.addAccount')"
    novalidate
    @submit="onSubmit"
    @close="emit('cancel')"
  >
    <FormField :label="$t('accounts.bank')" for="account-bank">
      <p v-if="isEdit" id="account-bank" class="form-control-plaintext">
        {{ selectedBankName }}
      </p>
      <select
        v-else
        id="account-bank"
        v-model="selectedBankId"
        v-bind="bankIdAttrs"
        v-autofocus
        class="form-select"
        :class="{ 'is-invalid': errors.bankId }"
      >
        <option v-for="bank in props.banks" :key="bank.id" :value="bank.id">
          {{ bank.name }}
        </option>
      </select>
    </FormField>

    <FormField
      :label="$t('accounts.accountName')"
      for="account-name"
      :error="errors.name && $t('auth.validation.required')"
    >
      <input
        id="account-name"
        v-model="name"
        v-bind="nameAttrs"
        v-autofocus="isEdit"
        type="text"
        class="form-control"
        :class="{ 'is-invalid': errors.name }"
      />
    </FormField>

    <FormField
      :label="$t('accounts.currency')"
      for="account-currency"
      :error="!isEdit && errors.currency ? $t('accounts.validation.currency') : undefined"
    >
      <p v-if="isEdit" id="account-currency" class="form-control-plaintext">
        {{ selectedCurrencyLabel }}
      </p>
      <select
        v-else
        id="account-currency"
        v-model="currency"
        v-bind="currencyAttrs"
        class="form-select"
        :class="{ 'is-invalid': errors.currency }"
      >
        <option value="">{{ $t('accounts.chooseCurrency') }}</option>
        <option v-for="option in currencyOptions" :key="option.code" :value="option.code">
          {{ option.code }} — {{ option.name }}
        </option>
      </select>
    </FormField>

    <FormField v-if="!isEdit" :label="$t('accounts.initialBalance')" for="account-initial-balance">
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
    </FormField>

    <template #actions>
      <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
        {{ $t('accounts.submit') }}
      </button>
    </template>
  </FormDrawer>
</template>

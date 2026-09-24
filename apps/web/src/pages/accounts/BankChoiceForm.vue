<script setup lang="ts">
import { watch } from 'vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { useI18n } from 'vue-i18n';
import { apiClient } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';
import FormField from '../../components/FormField.vue';
import FormDrawer from '../../components/FormDrawer.vue';
import { useToast } from '../../composables/useToast';
import { bankChoiceSchema, type BankChoiceForm } from './accounts.schemas';
import type { Bank } from './accounts.types';

// "New account" starts here — choose one of the member's existing
// active banks, or create a new one — before account creation even
// starts.
const props = defineProps<{ banks: Bank[] }>();
const emit = defineEmits<{ chosen: [bankId: string]; cancel: [] }>();

const { push: toast } = useToast();
const { t } = useI18n();

const { defineField, handleSubmit, errors, isSubmitting } = useForm<BankChoiceForm>({
  validationSchema: toTypedSchema(bankChoiceSchema),
  initialValues: { bankId: '', bankName: '' },
});
const [bankId, bankIdAttrs] = defineField('bankId');
const [bankName, bankNameAttrs] = defineField('bankName');

// The two options are mutually exclusive — selecting one clears the
// other as the member interacts with the form, not only at submit.
watch(bankId, (value) => {
  if (value) bankName.value = '';
});
watch(bankName, (value) => {
  if (value) bankId.value = '';
});

const onSubmit = handleSubmit(async (values) => {
  if (values.bankId) {
    emit('chosen', values.bankId);
    return;
  }

  const { data, error, response } = await apiClient.POST('/banks/choice', {
    body: { name: values.bankName },
  });
  if (!response.ok) {
    toast(errorMessage(error) ?? t('accounts.genericError'), 'error');
    return;
  }
  toast(t('accounts.bankSaved'), 'success');
  const created = data as unknown as { id: string };
  emit('chosen', created.id);
});
</script>

<template>
  <FormDrawer
    :title="$t('accounts.addAccount')"
    novalidate
    @submit="onSubmit"
    @close="emit('cancel')"
  >
    <FormField :label="$t('accounts.existingBank')" for="account-bank-id">
      <select
        id="account-bank-id"
        v-model="bankId"
        v-bind="bankIdAttrs"
        v-autofocus
        class="form-select"
        :class="{ 'is-invalid': errors.bankId }"
      >
        <option value="">{{ $t('accounts.chooseBank') }}</option>
        <option v-for="bank in props.banks" :key="bank.id" :value="bank.id">
          {{ bank.name }}
        </option>
      </select>
    </FormField>

    <FormField
      :label="$t('accounts.newBankName')"
      for="account-bank-name"
      :error="errors.bankName && $t('accounts.validation.bankChoiceRequired')"
    >
      <input
        id="account-bank-name"
        v-model="bankName"
        v-bind="bankNameAttrs"
        type="text"
        class="form-control"
        :class="{ 'is-invalid': errors.bankName }"
        :disabled="!!bankId"
      />
    </FormField>

    <template #actions>
      <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
        {{ $t('accounts.next') }}
      </button>
    </template>
  </FormDrawer>
</template>

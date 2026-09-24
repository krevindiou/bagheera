<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { useI18n } from 'vue-i18n';
import { apiClient } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';
import FormDrawer from '../../components/FormDrawer.vue';
import { useToast } from '../../composables/useToast';
import type { Account, Bank } from '../accounts/accounts.types';
import { entryFormValues, entryRequestFields } from './entryForm';
import OperationFields from './OperationFields.vue';
import { operationSchema, type OperationForm } from './operations.schemas';
import type { Category, Operation, PaymentMethod } from './operations.types';

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
const { t } = useI18n();

const { handleSubmit, isSubmitting, resetForm } = useForm<OperationForm>({
  validationSchema: toTypedSchema(operationSchema),
  initialValues: entryFormValues(props.operation),
});

async function submitForm(submitted: OperationForm): Promise<boolean> {
  const body = entryRequestFields(props.accountId, submitted);

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
    resetForm({ values: entryFormValues(null) });
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
    <OperationFields
      id-prefix="operation"
      :account-id="accountId"
      :categories="categories"
      :payment-methods="paymentMethods"
      :accounts="accounts"
      :banks="banks"
      :stored-transfer-account-id="operation?.transferAccountId"
      :value-date-label="$t('operations.valueDate')"
      :transfer-placeholder="$t('operations.externalAccount')"
    />

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

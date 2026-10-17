<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiClient } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';
import FormDrawer from '../../components/FormDrawer.vue';
import { focusFirstInvalid } from '../../composables/focusFirstInvalid';
import { useConfirm } from '../../composables/useConfirm';
import { useToast } from '../../composables/useToast';
import { useSessionStore } from '../../stores/session.store';
import type { Account, Bank } from '../accounts/accounts.types';
import { entryFormValues, entryRequestFields } from './entryForm';
import OperationFields from './OperationFields.vue';
import {
  operationSchema,
  type OperationForm,
  type OperationFormValues,
} from './operations.schemas';
import type { Category, Operation, PaymentMethod } from '../../domain/referenceData';

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
const emit = defineEmits<{ saved: []; savedAndNew: []; deleted: []; cancel: [] }>();

const { push: toast } = useToast();
const { confirm } = useConfirm();
const { t } = useI18n();
const session = useSessionStore();

const fields = ref<InstanceType<typeof OperationFields> | null>(null);
const isDeleting = ref(false);

const { handleSubmit, isSubmitting, resetForm } = useForm<OperationFormValues, OperationForm>({
  validationSchema: toTypedSchema(operationSchema),
  initialValues: entryFormValues(props.operation, session.member?.timeZone),
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
}, focusFirstInvalid);

// Creation form only: saves and immediately returns to a fresh creation
// form for the same account, instead of closing, focused on its first field.
const onSubmitAndNew = handleSubmit(async (submitted) => {
  if (await submitForm(submitted)) {
    resetForm({ values: entryFormValues(null, session.member?.timeZone) });
    emit('savedAndNew');
    await nextTick();
    fields.value?.focus();
  }
}, focusFirstInvalid);

// There's no single-operation delete route; the batch one with a single id
// does the same job (ownership-scoped, same business rules) without a
// second server endpoint to maintain.
async function onDelete() {
  if (!props.operation) return;

  const confirmed = await confirm({
    body: t('operations.batch.confirmDelete', 1),
    confirmLabel: t('common.delete'),
    danger: true,
  });
  if (!confirmed) return;

  isDeleting.value = true;
  const { data, error, response } = await apiClient.POST('/operations/batch/delete', {
    body: { ids: [props.operation.id] },
  });
  isDeleting.value = false;

  if (!response.ok || !data?.deletedCount) {
    toast(errorMessage(error) ?? t('operations.genericError'), 'error');
    return;
  }

  toast(t('operations.deleted'), 'success');
  emit('deleted');
}
</script>

<template>
  <FormDrawer
    :title="$t(props.operation ? 'operations.editTitle' : 'operations.createTitle')"
    novalidate
    @submit="onSubmit"
    @close="emit('cancel')"
  >
    <OperationFields
      ref="fields"
      id-prefix="operation"
      :account-id="accountId"
      :categories="categories"
      :payment-methods="paymentMethods"
      :accounts="accounts"
      :banks="banks"
      :stored-transfer-account-id="operation?.transferAccountId"
      :value-date-label="$t('operations.valueDate')"
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
      <button
        v-if="props.operation"
        type="button"
        class="btn btn-outline-danger"
        :disabled="isSubmitting || isDeleting"
        @click="onDelete"
      >
        {{ $t('common.delete') }}
      </button>
    </template>
  </FormDrawer>
</template>

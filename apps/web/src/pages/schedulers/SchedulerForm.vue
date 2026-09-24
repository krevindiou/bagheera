<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { useI18n } from 'vue-i18n';
import { apiClient } from '../../api/client';
import { errorMessage } from '../../api/errorMessage';
import FormDrawer from '../../components/FormDrawer.vue';
import FormField from '../../components/FormField.vue';
import { useToast } from '../../composables/useToast';
import type { Account, Bank } from '../accounts/accounts.types';
import { entryFormValues, entryRequestFields } from '../operations/entryForm';
import OperationFields from '../operations/OperationFields.vue';
import type { Category, PaymentMethod } from '../operations/operations.types';
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

function initialValues(): SchedulerForm {
  const s = props.scheduler;
  return {
    ...entryFormValues(s),
    limitDate: s?.limitDate ?? undefined,
    frequencyUnit: s?.frequencyUnit ?? 'month',
    frequencyValue: s?.frequencyValue ?? 1,
    active: s?.active ?? true,
  };
}

// The fields shared with the operation form live in OperationFields; only
// the scheduler's own (frequency, limit date, active) are bound here.
const { defineField, handleSubmit, errors, isSubmitting } = useForm<SchedulerForm>({
  validationSchema: toTypedSchema(schedulerSchema),
  initialValues: initialValues(),
});
const [limitDate, limitDateAttrs] = defineField('limitDate');
const [frequencyUnit, frequencyUnitAttrs] = defineField('frequencyUnit');
const [frequencyValue, frequencyValueAttrs] = defineField('frequencyValue');
const [active, activeAttrs] = defineField('active');

const onSubmit = handleSubmit(async (submitted) => {
  const body = {
    ...entryRequestFields(props.accountId, submitted),
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
    <OperationFields
      id-prefix="scheduler"
      :account-id="accountId"
      :categories="categories"
      :payment-methods="paymentMethods"
      :accounts="accounts"
      :banks="banks"
      :stored-transfer-account-id="scheduler?.transferAccountId"
      :value-date-label="$t('schedulers.firstOccurrence')"
      :transfer-placeholder="$t('operations.chooseTransferAccount')"
    >
      <template #after-value-date>
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
          <FormField
            class="col"
            :label="$t('schedulers.frequencyUnit')"
            for="scheduler-frequency-unit"
          >
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
      </template>

      <template #end>
        <div class="mb-3 form-check">
          <input
            id="scheduler-active"
            v-model="active"
            v-bind="activeAttrs"
            type="checkbox"
            class="form-check-input"
          />
          <label class="form-check-label" for="scheduler-active">{{
            $t('schedulers.active')
          }}</label>
        </div>
      </template>
    </OperationFields>

    <template #actions>
      <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
        {{ $t('operations.submit') }}
      </button>
    </template>
  </FormDrawer>
</template>
